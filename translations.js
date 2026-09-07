'use strict';
const catalyst = require('zcatalyst-sdk-node');
const https = require('https');

function callGLM(endpointUrl, authHeader, orgId, messages, opts) {
    const fast = opts && opts.fast;
    const maxTokens = (opts && opts.maxTokens) || (fast ? 300 : 900);
    const enableThinking =
        (opts && typeof opts.enableThinking === 'boolean')
            ? opts.enableThinking
            : false;

    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            model: "crm-di-glm47b_30b_it",
            messages: messages,
            max_tokens: maxTokens,
            temperature: 0.2,
            stream: false,
            chat_template_kwargs: {
                enable_thinking: enableThinking
            }
        });

        const url = new URL(endpointUrl);

        const options = {
            hostname: url.hostname,
            path: url.pathname + (url.search || ''),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader,
                'CATALYST-ORG': orgId,
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', chunk => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);

                    if (res.statusCode >= 400) {
                        reject(new Error(
                            `GLM HTTP ${res.statusCode}: ${data.slice(0, 500)}`
                        ));
                        return;
                    }

                    resolve(parsed);
                } catch (e) {
                    reject(new Error(
                        'Failed to parse GLM response: ' + data.slice(0, 500)
                    ));
                }
            });
        });

        req.setTimeout(25000, () => {
            req.destroy(new Error('GLM request timed out after 15s'));
        });

        req.on('error', reject);

        req.write(payload);
        req.end();
    });
}

async function callGLMWithRetry(
    endpointUrl,
    authHeader,
    orgId,
    messages,
    opts,
    maxRetries
) {
    maxRetries = typeof maxRetries === 'number' ? maxRetries : 0;

    let lastErr;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await callGLM(
                endpointUrl,
                authHeader,
                orgId,
                messages,
                opts
            );
        } catch (err) {
            lastErr = err;

            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
    }

    throw lastErr;
}


// QuickML's backend sometimes double-encodes non-Latin text: our UTF-8 bytes get
// misread as Latin-1 somewhere in its pipeline before being JSON-serialized back to us.
// This reverses that specific corruption (safe for this app since it only ever
// handles English/Kannada, and genuine English text won't trigger the heuristic).
function fixMojibake(text, forceCheck) {
    if (!text) return text;
    const looksCorrupted = /[\u00A0-\u00FF]{3,}/.test(text);
    if (!forceCheck && !looksCorrupted) return text;
    try {
        const repaired = Buffer.from(text, 'latin1').toString('utf8');
        if (!repaired.includes('\uFFFD')) return repaired;
    } catch (e) { /* fall through */ }
    return text;
}

function stripThink(text) {
    if (!text) return '';
    if (text.includes('</think>')) {
        return text.split('</think>').pop().trim();
    }
    return text.trim();
}

function callTranslate(authHeader, orgId, text, tgtLang) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            text: text,
            src_lang: tgtLang === "en" ? "kn" : "en",
            tgt_lang: tgtLang
        });
        const url = new URL("https://api.catalyst.zoho.in/quickml/api/v1/models/zia/translate");
        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader,
                'CATALYST-ORG': orgId,
                'Content-Length': Buffer.byteLength(payload)
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 400) {
                        reject(new Error(`Translate HTTP ${res.statusCode}: ${data.slice(0, 500)}`));
                        return;
                    }
                    resolve(parsed);
                } catch (e) {
                    reject(new Error('Failed to parse translate response: ' + data));
                }
            });
        });
        req.setTimeout(8000, () => {
            req.destroy(new Error('Translate request timed out after 8s'));
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

async function translateFinalAnswerToKannada(authHeader, orgId, finalAnswer) {
    const reasoningArr = finalAnswer.reasoning || [];
    const tasks = [
        callTranslate(authHeader, orgId, finalAnswer.insight, 'kn'),
        callTranslate(authHeader, orgId, finalAnswer.recommendation, 'kn'),
        ...reasoningArr.map(r => callTranslate(authHeader, orgId, r, 'kn'))
    ];
    const results = await Promise.all(tasks);
    const [insightRes, recRes, ...reasoningRes] = results;
    return {
        insight: insightRes.translated_text || finalAnswer.insight,
        recommendation: recRes.translated_text || finalAnswer.recommendation,
        reasoning: reasoningRes.map((r, i) => (r && r.translated_text) || reasoningArr[i])
    };
}
// Best-effort recovery for JSON cut off mid-generation. Tracks the position of the
// last fully-complete value (closed string, complete number/bool/null, or a closed
// nested array/object) along with the container stack at that point, then cuts
// there and closes whatever was still open. This avoids leaving a dangling key
// with no value (e.g. `"reasoning":` with nothing after it), which is invalid
// JSON no matter what brackets you append.

// Extract the first valid JSON object from a string (model sometimes wraps in prose/fences)
// Falls back to repairing truncated JSON (unclosed strings/arrays/braces) instead of
// discarding a mostly-complete response when max_tokens cuts it off mid-generation.
function extractJSON(text) {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced ? fenced[1] : text;
    const start = candidate.indexOf('{');
    if (start === -1) return null;

    let slice = candidate.slice(start);
    const end = slice.lastIndexOf('}');
    if (end !== -1) {
        try {
            return JSON.parse(slice.slice(0, end + 1));
        } catch (e) {
            // fall through to repair
        }
    }

    return repairTruncatedJSON(slice);
}



// Best-effort recovery for JSON cut off mid-generation. Tracks the position of the
// last fully-complete value (closed string, complete number/bool/null, or a closed
// nested array/object) along with the container stack at that point, then cuts
// there and closes whatever was still open. This avoids leaving a dangling key
// with no value (e.g. `"reasoning":` with nothing after it), which is invalid
// JSON no matter what brackets you append.

function repairTruncatedJSON(slice) {
    let stack = [];
    let inString = false;
    let escape = false;
    let lastGoodCut = null; // { index, stack snapshot }

    const recordCut = (idx) => {
        lastGoodCut = { index: idx, stack: stack.slice() };
    };

    for (let i = 0; i < slice.length; i++) {
        const ch = slice[i];

        if (inString) {
            if (escape) { escape = false; continue; }
            if (ch === '\\') { escape = true; continue; }
            if (ch === '"') { inString = false; recordCut(i + 1); }
            continue;
        }

        if (ch === '"') { inString = true; continue; }
        if (ch === '{' || ch === '[') { stack.push(ch); continue; }
        if (ch === '}' || ch === ']') { stack.pop(); recordCut(i + 1); continue; }

        if (/[0-9\-]/.test(ch)) {
            let j = i;
            while (j < slice.length && /[0-9eE+\-.]/.test(slice[j])) j++;
            recordCut(j);
            i = j - 1;
            continue;
        }

        if (slice.slice(i, i + 4) === 'true') { recordCut(i + 4); i += 3; continue; }
        if (slice.slice(i, i + 5) === 'false') { recordCut(i + 5); i += 4; continue; }
        if (slice.slice(i, i + 4) === 'null') { recordCut(i + 4); i += 3; continue; }
    }

    if (!lastGoodCut) return null;

    let repaired = slice.slice(0, lastGoodCut.index);
    const stackAtCut = lastGoodCut.stack;
    for (let i = stackAtCut.length - 1; i >= 0; i--) {
        repaired += stackAtCut[i] === '{' ? '}' : ']';
    }

    try {
        return JSON.parse(repaired);
    } catch (e) {
        return null;
    }
}

// Restores a helper that several tools below depend on (toolGetHotspots and,
// through it, get_hotspots / get_cctv_recommendations / calculate_risk_score)
// but which was missing from this file -- takes one full SELECT query string
// and paginates it, unlike fetchAllRowsParallel which takes separate
// select/table/where clauses.
async function fetchAllRows(zcql, fullQuery, pageSize = 299) {
    let allRows = [];
    let offset = 1;
    while (true) {
        const page = await zcql.executeZCQLQuery(`${fullQuery} LIMIT ${offset}, ${pageSize}`);
        if (!page || page.length === 0) break;
        allRows = allRows.concat(page);
        if (page.length < pageSize) break;
        offset += pageSize;
    }
    return allRows;
}
async function toolCrimeStats(zcql, params, districtNameToId, crimeTypeMap) {

    const { district, crimeType, status } = params || {};
    const conditions = [];
    if (district) {
        const districtId = resolveDistrictId(district, districtNameToId);
        if (districtId) {
            conditions.push(`DistrictId = '${districtId}'`);
        }
        // If nothing reasonably matches, skip the filter instead of injecting
        // an unresolved raw string into the query.
    }
    if (crimeType) {
        const normalizedType = crimeTypeMap[crimeType.toLowerCase()] || crimeType;
        conditions.push(`CrimeType = '${normalizedType}'`);
    }
    if (status) {
        const knownStatuses = ['Under Investigation', 'Chargesheeted', 'Closed'];
        const normalizedStatus = knownStatuses.find(s => s.toLowerCase() === status.toLowerCase()) || status;
        conditions.push(`Status = '${normalizedStatus}'`);
    }
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';

    const totalQ = await zcql.executeZCQLQuery(`SELECT COUNT(ROWID) FROM CaseMaster${where}`);
    const total = parseInt(totalQ[0]?.CaseMaster?.['COUNT(ROWID)'] ?? 0);

    const byTypeQ = await zcql.executeZCQLQuery(
        `SELECT CrimeType, COUNT(ROWID) FROM CaseMaster${where} GROUP BY CrimeType`
    );
    const byType = byTypeQ.map(r => ({
        crimeType: r.CaseMaster.CrimeType,
        count: parseInt(r.CaseMaster['COUNT(ROWID)'] ?? 0)
    })).sort((a, b) => b.count - a.count);

    const byStatusQ = await zcql.executeZCQLQuery(
        `SELECT Status, COUNT(ROWID) FROM CaseMaster${where} GROUP BY Status`
    );
    const byStatus = byStatusQ.map(r => ({
        status: r.CaseMaster.Status,
        count: parseInt(r.CaseMaster['COUNT(ROWID)'] ?? 0)
    }));

    return { total, byType, byStatus };
}

async function toolCompareDistricts(zcql, params, districtNameToId, crimeTypeMap) {
    const names = params?.districts || [];
    const results = [];
    for (const name of names) {
        const id = resolveDistrictId(name, districtNameToId);
        if (!id) {
            results.push({ district: name, error: 'District not found' });
            continue;
        }
        const stats = await toolCrimeStats(zcql, { district: id }, districtNameToId, crimeTypeMap);
        const chargesheeted = stats.byStatus.find(s => s.status === 'Chargesheeted')?.count || 0;
        const rate = stats.total > 0 ? Math.round((chargesheeted / stats.total) * 1000) / 10 : 0;
        results.push({
            district: name,
            totalCases: stats.total,
            topCrimeType: stats.byType[0]?.crimeType || null,
            chargesheetRate: rate,
            byType: stats.byType.slice(0, 5)
        });
    }
    return { comparison: results };
}

async function toolGetHotspots(zcql, params, districtNameToId) {
    const { district, limit } = params || {};
    const cases = await fetchAllRows(zcql, "SELECT ROWID, UnitId, DistrictId, Latitude, Longitude FROM CaseMaster" +
        (district ? (() => { const rid = resolveDistrictId(district, districtNameToId); return rid ? ` WHERE DistrictId = '${rid}'` : ''; })() : ''));
    const cameras = await fetchAllRows(zcql, "SELECT ROWID, UnitId, Status FROM CCTVLocation");
    const unitRows = await fetchAllRows(zcql, "SELECT ROWID, UnitName FROM Unit");
    const unitNameById = {};
    unitRows.forEach(row => { unitNameById[row.Unit.ROWID] = row.Unit.UnitName; });

    const unitStats = {};
    for (const row of cases) {
        const c = row.CaseMaster;
        const uid = c.UnitId;
        if (!unitStats[uid]) unitStats[uid] = { unitId: uid, districtId: c.DistrictId, caseCount: 0 };
        unitStats[uid].caseCount += 1;
    }
    const cameraCountByUnit = {};
    for (const row of cameras) {
        const cam = row.CCTVLocation;
        if (cam.Status === 'Active') cameraCountByUnit[cam.UnitId] = (cameraCountByUnit[cam.UnitId] || 0) + 1;
    }
    const units = Object.values(unitStats);
    const maxCases = Math.max(...units.map(u => u.caseCount), 1);
    const scored = units.map(u => ({
        ...u,
        unitName: unitNameById[u.unitId] || u.unitId,
        riskScore: Math.round((u.caseCount / maxCases) * 100),
        cameraCount: cameraCountByUnit[u.unitId] || 0,
        hasCCTV: (cameraCountByUnit[u.unitId] || 0) > 0
    })).sort((a, b) => b.riskScore - a.riskScore);

    return { hotspots: scored.slice(0, limit || 10) };
}

// Resolves a user/model-supplied district name to its real DB ROWID, tolerating
// common variations (e.g. "Bengaluru" -> "Bengaluru Urban", "Chikmagalur" ->
// "Chikkamagaluru"). Falls back progressively: exact match, then any known
// district name that contains the input or vice versa. Returns null if nothing
// reasonably matches, rather than ever injecting an unresolved raw string into
// a ZCQL query — which previously caused silent query failures and the model
// looping on an identical failing tool call.
// Small best-effort glossary for police-domain status terms that QuickML's
// general-purpose translator sometimes mistranslates (e.g. "closed case"
// mistranslated as "high-profile"/"filed" instead of the real Status enum
// value). Applied to the raw Kannada text BEFORE translation, as a targeted
// word-level correction -- not a full translation. Covers only the three
// real Status values already used elsewhere in this app; extend the list
// below if more mistranslations are found. NOTE: composed by a non-native
// Kannada speaker -- have a Kannada-speaking reviewer verify/extend this.
const KANNADA_STATUS_GLOSSARY = [
    // District/crime-type terms below are confirmed from real tested queries
    // in this app (not guessed) -- extend only with terms verified the same
    // way, or by a Kannada-speaking reviewer. Do NOT add unverified spellings.
    { pattern: /\u0cae\u0cc8\u0cb8\u0cc2\u0cb0/g, replacement: 'Mysuru' },   // à²®à³ˆà²¸à³‚à²°à³
    { pattern: /\u0cac\u0cc6\u0c82\u0c97\u0cb3\u0cc2\u0cb0/g, replacement: 'Bengaluru' }, // à²¬à³†à²‚à²—à²³à³‚à²°à³
    { pattern: /\u0cb5\u0c82\u0c9a\u0ca8\u0cc6/g, replacement: 'Fraud' },          // à²µà²‚à²šà²¨à³†
    { pattern: /\u0c95\u0cb3\u0ccd\u0cb3\u0ca4\u0ca8/g, replacement: 'Theft' },    // à²•à²³à³à²³à²¤à²¨
    { pattern: /\u0cae\u0cc1\u0c9a\u0ccd\u0c9a\u0cbf\u0ca6/g, replacement: 'Closed' },       // à²®à³à²šà³à²šà²¿à²¦ (closed)
    { pattern: /\u0cae\u0cc1\u0c97\u0cbf\u0ca6/g, replacement: 'Closed' },                    // à²®à³à²—à²¿à²¦ (finished/closed)
    { pattern: /\u0ca4\u0ca8\u0cbf\u0c96\u0cc6\u0caf\u0cb2\u0ccd\u0cb2\u0cbf\u0cb0\u0cc1\u0cb5/g, replacement: 'Under Investigation' }, // à²¤à²¨à²¿à²–à³†à²¯à²²à³à²²à²¿à²°à³à²µ
    { pattern: /\u0c86\u0cb0\u0ccb\u0caa\u0caa\u0c9f\u0ccd\u0c9f\u0cbf/g, replacement: 'Chargesheeted' }, // à²†à²°à³‹à²ªà²ªà²Ÿà³à²Ÿà²¿
];

function applyKannadaStatusGlossary(text) {
    let result = text;
    for (const { pattern, replacement } of KANNADA_STATUS_GLOSSARY) {
        result = result.replace(pattern, replacement);
    }
    return result;
}

function resolveDistrictId(districtInput, districtNameToId) {
    if (!districtInput) return null;
    const key = districtInput.toLowerCase().trim();
    if (districtNameToId[key]) return districtNameToId[key];
    const knownNames = Object.keys(districtNameToId);
    const match = knownNames.find(name => name.includes(key) || key.includes(name));
    return match ? districtNameToId[match] : null;
}

async function toolCCTVRecommendations(zcql, params, districtNameToId) {
    const hotspotResult = await toolGetHotspots(zcql, { district: params?.district, limit: 500 }, districtNameToId);
    const gaps = hotspotResult.hotspots.filter(u => !u.hasCCTV).slice(0, params?.limit || 10);
    return { recommendations: gaps };
}

async function toolRiskScore(zcql, params, districtNameToId) {
    const result = await toolGetHotspots(zcql, { district: params?.district, limit: 500 }, districtNameToId);
    if (params?.district) {
        const avg = result.hotspots.reduce((s, u) => s + u.riskScore, 0) / (result.hotspots.length || 1);
        return { district: params.district, averageRiskScore: Math.round(avg), unitBreakdown: result.hotspots };
    }
    return result;
}
// Real top-N offenders by associate count, drawn from the FULL precomputed
// network dataset (all repeat offenders) -- not a trimmed/sampled subset.
async function toolMostConnectedOffenders(zcql, params) {
    const limit = Math.min(params?.limit || 10, 50);
    return await fetchInternalFunction(`/network-graph-function/?mode=top_connected&limit=${limit}`);
}

const FUNCTIONS_BASE_HOST = 'ksp-fir-platform-60073928681.development.catalystserverless.in';
function fetchInternalFunction(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: FUNCTIONS_BASE_HOST,
            path: `/server${path}`,
            method: 'GET'
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse response from ${path}: ${data.slice(0, 200)}`));
                }
            });
        });
        req.setTimeout(12000, () => req.destroy(new Error(`Internal call to ${path} timed out`)));
        req.on('error', reject);
        req.end();
    });
}

async function toolCCTVStatus(zcql, params, districtNameToId) {
    const { district, limit } = params || {};
    let path = '/cctv-recommend-function/?';
    const qs = [];
    if (district) {
        const rid = resolveDistrictId(district, districtNameToId);
        if (rid) qs.push(`district=${rid}`);
    }
    if (limit) qs.push(`limit=${limit}`);
    path += qs.join('&');
    return await fetchInternalFunction(path);
}

async function toolPatrolRecommendations(zcql, params, districtNameToId) {
    const { district, limit } = params || {};
    let path = '/patrol-recommend-function/?';
    const qs = [];
    if (district) {
        const rid = resolveDistrictId(district, districtNameToId);
        if (rid) qs.push(`district=${rid}`);
    }
    if (limit) qs.push(`limit=${limit}`);
    path += qs.join('&');
    return await fetchInternalFunction(path);
}

async function toolCriminalNetwork(zcql, params) {
    const { limit } = params || {};
    let path = '/network-graph-function/?';
    const qs = [];
    if (limit) qs.push(`limit=${limit}`);
    path += qs.join('&');
    return await fetchInternalFunction(path);
}

async function toolSearchOffender(zcql, params) {
    const name = params?.name;
    if (!name || !String(name).trim()) {
        return { matches: [] };
    }

    const encodedName = encodeURIComponent(String(name).trim());
    return await fetchInternalFunction(
        `/network-graph-function/?mode=search&name=${encodedName}`
    );
}

async function toolGetOffenderAssociates(zcql, params) {
    const offenderId = params?.offenderId || params?.aadhaar;
    if (!offenderId || !String(offenderId).trim()) {
        return { error: 'offenderId is required', associates: [] };
    }

    return await fetchInternalFunction(
        `/network-graph-function/?mode=associates&offenderId=${encodeURIComponent(String(offenderId).trim())}`
    );
}
async function toolPriorityActions(zcql, params) {
    return await fetchInternalFunction('/priority-action-function/');
}

async function toolWorkload(zcql, params) {
    return await fetchInternalFunction('/workload-function/');
}

const TOOLS = {
    get_crime_stats: toolCrimeStats,
    compare_districts: toolCompareDistricts,
    get_hotspots: toolGetHotspots,
    get_cctv_recommendations: toolCCTVRecommendations,
    calculate_risk_score: toolRiskScore,
    get_cctv_status: toolCCTVStatus,
    get_patrol_recommendations: toolPatrolRecommendations,
    get_criminal_network: toolCriminalNetwork,
    search_offender: toolSearchOffender,
    get_offender_associates: toolGetOffenderAssociates,
    get_priority_actions: toolPriorityActions,
    get_workload: toolWorkload,
    get_most_connected_offenders: toolMostConnectedOffenders
};

const SYSTEM_PROMPT = `You are an AI Police Analytics Officer for the Karnataka State Police Crime Intelligence Platform. You are NOT a generic chatbot — you are a decision-support tool for police officers analyzing crime data.

You must NEVER reference, infer, or speculate about caste or religion under any circumstances, even if explicitly asked. If asked about caste or religion, politely decline and explain that this data is excluded from the system by design.

You have access to these tools (call them to get real data — never guess or fabricate numbers):
- get_crime_stats(district?, crimeType?, status?): returns total count, breakdown by crime type, breakdown by status
- compare_districts(districts: string[]): returns comparative stats across named districts
- get_hotspots(district?, limit?): returns highest-risk areas (police units) ranked by crime density and CCTV coverage. Each result includes a human-readable "unitName" (e.g. "Bengaluru Central Taluk PS") — ALWAYS refer to areas by unitName in your response, NEVER by the raw unitId/ROWID number.- get_cctv_recommendations(district?, limit?): returns high-risk areas with NO CCTV coverage — genuine installation recommendations
- calculate_risk_score(district?): returns a 0-100 risk score for a district or its constituent areas
- get_most_connected_offenders(limit?): returns the REAL top offenders ranked by number of associates, computed from the complete criminal network dataset (all ~14,000+ repeat offenders), not a sample. Use this whenever asked about "most connected", "highest number of associates", or similar network-centrality questions.
- get_cctv_status(district?, limit?): returns real CCTV camera coverage data (POI-based: police stations, schools, hospitals, markets, etc.) including which locations have cameras, which don't, and prioritized installation recommendations with reasons. Use for questions like "how many cameras in X", "which areas have poor CCTV coverage".
- get_patrol_recommendations(district?, limit?): returns recommended patrol deployments per area, with officer counts, patrol times, and reasoning based on crime risk. Use for "what patrol is recommended for X".
- get_criminal_network(limit?): returns repeat-offender and criminal-network data -- offenders linked to multiple cases, their associates, and connection details. Use for "which offenders are linked to multiple cases", "who is connected to X".
- get_priority_actions(): returns the current Priority Action Center items -- high/critical-priority police stations or cases flagged for attention, with the reason each was flagged. Use for "why is X high priority", "what needs attention right now".
- get_workload(): returns officer/unit workload data across police stations. Use for "which stations are overloaded", "workload for X".
- get_most_connected_offenders(limit?): returns the REAL top offenders ranked by number of associates, computed from the complete criminal network dataset (all ~14,000+ repeat offenders), not a small sample. ALWAYS use this specific tool (not get_criminal_network) for questions about "most connected", "highest number of associates", "biggest network", or similar offender-centrality questions — get_criminal_network only returns a small trimmed subset and will give an inaccurate answer for this kind of question.

When a tool's JSON result contains fields you don't recognize, describe them in plain language anyway based on their names and values -- do not refuse to answer just because the exact schema wasn't documented above.
Always write the "insight", "reasoning", and "recommendation" fields in clear, natural English, regardless of what language the user's question was written in. Do not translate them yourself â€” a separate step handles translation if needed.

STRICT CRIMINAL-NETWORK FOLLOW-UP RULE: If the current question asks for the people, associates, connections, or details of an offender mentioned in a previous turn (for example "who are they?", "who are his associates?", or "list them"), you MUST retrieve the actual data using tools before answering. Do NOT answer from conversation history alone and do NOT invent or infer associate names, counts, or details. If the previous answer contains the offender name but not the Aadhaar, first call search_offender with that exact offender name. If exactly one match exists, use its Aadhaar. If multiple matches exist, use the available context to select the matching offender; if it cannot be determined, ask for clarification. Then call get_offender_associates using the selected Aadhaar. The final answer must be based only on the retrieved associate data.
For criminal-network follow-ups, preserve the offender identity from the previous answer. If a previous answer identifies a specific offender with an Aadhaar and the next question is "who are they?", "who are his associates?", or similar, interpret the follow-up as referring to that same offender. Use get_offender_associates with the identified Aadhaar instead of searching again.
You may receive prior conversation turns before the current question. When the current question is a short follow-up that omits details a normal person would expect you to carry over -- e.g. "what about Mysuru?" right after a question about theft cases in Bengaluru -- treat it as asking the SAME thing (same crime type, same status filter, etc.) but for the new district/value mentioned. Only ask for clarification if the follow-up genuinely could not be interpreted this way.
You work in a loop. On EVERY turn, respond with ONLY a single JSON object, nothing else — no prose before or after, no markdown fences.

If you need data, respond with:
{"action": "call_tool", "tool": "<tool_name>", "params": { ... }}

Once you have enough information to answer, respond with:
{
  "action": "final_answer",
  "insight": "<the key finding, direct and specific>",
  "reasoning": ["<short reason 1>", "<short reason 2>", "<short reason 3, optional>"],
  "recommendation": "<a concrete, actionable suggestion for a police officer>",
  "confidence": <integer 0-100, reflecting how well the available data supports this answer>,
 "dashboardAction": { "type":
"filterDistrict"|"filterCrimeType"|"filterStatus"|"showHotspots"|"showCCTV"|"none", "district": "<district name if relevant, else omit>", "crimeType": "<crime type if relevant, else omit>", "status": "<case status if relevant, else omit>" }
}
}

If the user is asking you to FLAG A SPECIFIC CASE FOR REVIEW (not just asking a question about cases), and they have given a case/FIR identifier, respond ONLY with this JSON shape instead of final_answer or call_tool:
{
  "action": "propose_action",
  "actionType": "flag_case",
  "caseId": "<the FIR number or case id exactly as the user gave it>",
  "reason": "<a concise 1-sentence summary of why, based on what the user said>"
}
Do NOT execute this action yourself and do NOT claim it has been done -- you are only proposing it. A separate confirmation step outside your control will actually perform it. If the user did not provide a specific reason, use "Officer requested this case for review." as the reason.

Never fabricate statistics. If a tool returns no data for something, say so honestly in "reasoning" and lower the confidence score accordingly. Keep "insight" and "recommendation" concise â€” 1-2 short sentences each, maximum 25 words per sentence. Each "reasoning" bullet must be a single short sentence under 15 words. Do not repeat words or phrases.`;
// Builds a real final_answer directly from a tool result, without another
// model round-trip. Used when the model gets stuck repeating an identical
// tool call and won't self-correct — guarantees termination with a truthful,
// data-grounded answer instead of gambling on more retries.
function buildAnswerFromToolResult(result) {
    if (result && typeof result.total === 'number') {
        const byStatusStr = (result.byStatus || [])
            .map(s => `${s.count} ${s.status}`)
            .join(', ');
        return {
            insight: `There are ${result.total} matching cases. Breakdown by status: ${byStatusStr || 'not available'}.`,
            reasoning: [`Total matching cases: ${result.total}.`, byStatusStr ? `Status breakdown: ${byStatusStr}.` : 'Status breakdown unavailable.'],
            recommendation: 'Review the status breakdown to prioritize active investigations.',
            confidence: 70,
            dashboardAction: { type: 'none' }
        };
    }
    return {
        insight: `Data retrieved: ${JSON.stringify(result).slice(0, 300)}`,
        reasoning: ['Answer generated directly from retrieved data after the AI repeated an identical request.'],
        recommendation: 'Try rephrasing the question for a more detailed analysis.',
        confidence: 50,
        dashboardAction: { type: 'none' }
    };
}

module.exports = async (req, res) => {
    try {
        const catalystApp = catalyst.initialize(req);
        const zcql = catalystApp.zcql();
        const connections = catalystApp.connections();

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                               const parsed = JSON.parse(body || '{}');
const conversationHistory = Array.isArray(parsed.history) ? parsed.history : [];

                // Confirmed action execution -- called only when the user clicks
                // Confirm on a propose_action card, never by the AI model itself.
                if (parsed.action === 'translate_batch') {
                    const items = Array.isArray(parsed.items) ? parsed.items : [];
                    const targetLang = parsed.targetLang || 'kn';

                    if (items.length === 0) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.write(JSON.stringify({ translated: [] }));
                        return res.end();
                    }

                    try {
                        const connectionResponse = await connections.getConnectionCredentials('quickml');
                        const authHeader = connectionResponse.headers.Authorization;
                        const orgId = "60073928681";

                        const results = await Promise.all(
                            items.map(text =>
                                text && text.trim()
                                    ? callTranslate(authHeader, orgId, text, targetLang).catch(() => null)
                                    : Promise.resolve(null)
                            )
                        );
                        const translated = results.map((r, i) => (r && r.translated_text) || items[i]);

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.write(JSON.stringify({ translated }));
                        return res.end();
                    } catch (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.write(JSON.stringify({ error: err.message }));
                        return res.end();
                    }
                }
                if (parsed.action === 'execute_flag') {
                    if (!parsed.caseId || !parsed.reason) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.write(JSON.stringify({ error: 'caseId and reason are required' }));
                        return res.end();
                    }
                    const datastore = catalystApp.datastore();
                    const table = datastore.table('CaseFlag');
                    await table.insertRow({
                        CaseId: parsed.caseId,
                        FlaggedBy: parsed.flaggedBy || 'Unknown Officer',
                        Reason: parsed.reason,
                        Status: 'Open',
                        FlaggedAt: new Date().toISOString()
                    });
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.write(JSON.stringify({ success: true, message: `Case ${parsed.caseId} flagged for review.` }));
                    return res.end();
                }

                const question = parsed.question;
                const isNonLatin = question ? /[^\x00-\x7F]/.test(question) : false;

                let questionForModel = question;
                if (isNonLatin && question) {
                    try {
                        const connectionResponseEarly = await connections.getConnectionCredentials('quickml');
                        const authHeaderEarly = connectionResponseEarly.headers.Authorization;
                        const glossaryCorrectedQuestion = applyKannadaStatusGlossary(question);
                        const translatedQ = await callTranslate(authHeaderEarly, "60073928681", glossaryCorrectedQuestion, 'en');
                        if (translatedQ && translatedQ.translated_text) {
                            questionForModel = translatedQ.translated_text;
                        } else {
                            res.writeHead(502, { 'Content-Type': 'application/json' });
                            res.write(JSON.stringify({ error: 'Translation to English failed (no translated_text in response); refusing to send untranslated Kannada to the model.' }));
                            return res.end();
                        }
                    } catch (e) {
                        res.writeHead(502, { 'Content-Type': 'application/json' });
                        res.write(JSON.stringify({ error: 'Translation to English failed: ' + e.message }));
                        return res.end();
                    }
                }

                // Debug bypass: call a tool directly, skip the model entirely
                if (parsed.debugTool) {
                    const districtRowsD = await zcql.executeZCQLQuery("SELECT ROWID, DistrictName FROM District");
                    const districtNameToIdD = {};
                    districtRowsD.forEach(r => { districtNameToIdD[r.District.DistrictName.toLowerCase()] = r.District.ROWID; });
                    const crimeTypeRowsD = await zcql.executeZCQLQuery("SELECT CrimeType FROM CaseMaster GROUP BY CrimeType");
                    const crimeTypeMapD = {};
                    crimeTypeRowsD.forEach(r => { if (r.CaseMaster.CrimeType) crimeTypeMapD[r.CaseMaster.CrimeType.toLowerCase()] = r.CaseMaster.CrimeType; });

                    const toolFnD = TOOLS[parsed.debugTool];
                    if (!toolFnD) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.write(JSON.stringify({ error: `Unknown tool: ${parsed.debugTool}`, availableTools: Object.keys(TOOLS) }));
                        return res.end();
                    }
                    const result = await toolFnD(zcql, parsed.debugParams || {}, districtNameToIdD, crimeTypeMapD);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.write(JSON.stringify({ knownCrimeTypes: Object.values(crimeTypeMapD), result }));
                    return res.end();
                }

                if (!question) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.write(JSON.stringify({ error: 'Missing "question" in request body' }));
                    return res.end();
                }

                // Build district name -> id lookup (small table, safe to fetch fully)
                const districtRows = await zcql.executeZCQLQuery("SELECT ROWID, DistrictName FROM District");
                const districtNameToId = {};
                districtRows.forEach(r => {
                    districtNameToId[r.District.DistrictName.toLowerCase()] = r.District.ROWID;
                });

                // Build a case-insensitive crime-type lookup so the model doesn't need to guess exact capitalization
                const crimeTypeRows = await zcql.executeZCQLQuery("SELECT CrimeType FROM CaseMaster GROUP BY CrimeType");
                const crimeTypeMap = {};
                const knownCrimeTypes = [];
                crimeTypeRows.forEach(r => {
                    const actual = r.CaseMaster.CrimeType;
                    if (actual) {
                        crimeTypeMap[actual.toLowerCase()] = actual;
                        knownCrimeTypes.push(actual);
                    }
                });

                const connectionResponse = await connections.getConnectionCredentials('quickml');
                const authHeader = connectionResponse.headers.Authorization;
                const orgId = "60073928681";
                const endpointUrl = "https://api.catalyst.zoho.in/quickml/v1/project/48211000000047001/glm/chat";

                const languageDirective = isNonLatin
                    ? `\n\nCRITICAL: The user's question is written in Kannada script. You MUST write the "insight", "reasoning", and "recommendation" fields ENTIRELY in Kannada (ಕನ್ನಡ ಲಿಪಿ). Do not answer in English under any circumstances for this question.\n\nCRITICAL ENCODING RULE: Every single non-ASCII character (every Kannada character) in your JSON output MUST be written as a \\uXXXX unicode escape sequence, NOT as a raw character. For example, write ಮ as \\u0cae, ೈ as \\u0cc8, ಸ as \\u0cb8, and so on for every Kannada character. Do this for ALL Kannada text in insight, reasoning, and recommendation. This is mandatory - raw Kannada characters will be corrupted in transit, but \\uXXXX escapes will not.`
                    : `\n\nThe user's question is in English. Respond in English.`;
                const systemPromptWithTypes = SYSTEM_PROMPT + `\n\nKnown crime types in the database (use these exact names in tool params): ${knownCrimeTypes.join(', ')}` + languageDirective;

                // Fold prior turns in as alternating user/assistant messages so the
                // model has real conversational context for follow-ups like "what
                // about last month?" -- summarized (not the full tool-call trace)
                // to keep the prompt small.
                const historyMessages = conversationHistory.flatMap(turn => ([
                    { role: "user", content: turn.question },
                    { role: "assistant", content: JSON.stringify({ action: "final_answer", insight: turn.insight, reasoning: [], recommendation: "", confidence: 100, dashboardAction: { type: "none" } }) }
                ]));

                let messages = [
                    { role: "system", content: systemPromptWithTypes },
                    ...historyMessages,
                    { role: "user", content: questionForModel }
                ];

                const debugTrace = [];

                // Deterministic criminal-network follow-up handling.
                // If the user asks "who are they?" / "who are his associates?"
                // after an offender was identified, retrieve the real network data
                // before allowing the model to produce a final answer.

const lastHistoryTurn = conversationHistory.length
                    ? conversationHistory[conversationHistory.length - 1]
                    : null;

                const isNetworkFollowUp =
                    /^(who are they|who are they\?|who are his associates|who are her associates|who are their associates|list them|list his associates|list her associates|list their associates)[?.!]*$/i
                        .test(String(question || '').trim());

                if (isNetworkFollowUp && lastHistoryTurn?.insight) {
                    const previousInsight = String(lastHistoryTurn.insight);

                    // The previous network answer normally starts with:
                    // "<offender name> has ..."
                    const offenderNameMatch = previousInsight.match(
                        /^(.+?)\s+has\s+the\s+highest\s+number\s+of\s+associates/i
                    );

                    if (offenderNameMatch && offenderNameMatch[1]) {
                        const previousOffenderName = offenderNameMatch[1].trim();

                        try {
                            const searchResult = await toolSearchOffender(
                                zcql,
                                { name: previousOffenderName }
                            );

                            debugTrace.push({
                                tool: 'search_offender',
                                params: { name: previousOffenderName },
                                result: searchResult
                            });

                            const matches = Array.isArray(searchResult?.matches)
                                ? searchResult.matches
                                : [];

                            // Prefer the exact offender whose associate count matches
                            // the previous answer when multiple same-name records exist.
                            const countMatch = previousInsight.match(
                                /with\s+(\d+)\s+(?:total\s+)?connections/i
                            );
                            const previousAssociateCount = countMatch
                                ? Number(countMatch[1])
                                : null;

                            let selected = null;

                            if (previousAssociateCount !== null) {
                                selected = matches.find(
                                    m => Number(m.associateCount) === previousAssociateCount
                                );
                            }

                            if (!selected && matches.length === 1) {
                                selected = matches[0];
                            }

                            if (selected?.aadhaar) {
                                const associateResult = await toolGetOffenderAssociates(
                                    zcql,
                                    { offenderId: selected.aadhaar }
                                );

                                debugTrace.push({
                                    tool: 'get_offender_associates',
                                    params: { offenderId: selected.aadhaar },
                                    result: associateResult
                                });

                                messages.push({
                                    role: "user",
                                    content: `Tool result: ${JSON.stringify(associateResult)}`
                                });
                            }
                        } catch (followUpErr) {
                            console.log(
                                'DEBUG network follow-up retrieval failed:',
                                followUpErr.message
                            );
                        }
                    }
                }

                // Deterministic offender-name lookup.
                // Prevents the AI from using the limited criminal-network list
                // when the officer directly asks for details about a named offender.
                const offenderDetailsMatch = String(question || '').trim().match(
                    /^(?:give|show|tell me|provide)\s+(?:me\s+)?(?:the\s+)?details\s+(?:of|about)\s+(.+?)\??$/i
                );

                if (offenderDetailsMatch && offenderDetailsMatch[1]) {
                    const requestedOffenderName = offenderDetailsMatch[1].trim();

                    try {
                        const searchResult = await toolSearchOffender(
                            zcql,
                            { name: requestedOffenderName }
                        );

                        debugTrace.push({
                            tool: 'search_offender',
                            params: { name: requestedOffenderName },
                            result: searchResult
                        });

                        const matches = Array.isArray(searchResult?.matches)
                            ? searchResult.matches
                            : [];

                        if (matches.length === 0) {
                            messages.push({
                                role: "user",
                                content:
                                    `Tool result: No offender profile was found for "${requestedOffenderName}".`
                            });
                        } else if (matches.length === 1) {
                            messages.push({
                                role: "user",
                                content:
                                    `Tool result: ${JSON.stringify(matches[0])}`
                            });
                        } else {
                            messages.push({
                                role: "user",
                                content:
                                    `Tool result: Multiple offender profiles were found for "${requestedOffenderName}". ` +
                                    `Do not choose one arbitrarily. Ask the officer to provide an Aadhaar number, district, or case identifier to identify the correct profile. ` +
                                    `Matches: ${JSON.stringify(matches)}`
                            });
                        }
                    } catch (offenderSearchErr) {
                        console.log(
                            'DEBUG offender detail search failed:',
                            offenderSearchErr.message
                        );
                    }
                }

                let finalAnswer = null;
                const MAX_ITERATIONS = 4;
                const TIME_BUDGET_MS = 27000;
                const startTime = Date.now();


                for (let i = 0; i < MAX_ITERATIONS; i++) {
                    const elapsed = Date.now() - startTime;
                    const timeLeft = TIME_BUDGET_MS - elapsed;
                    const isLastRound = (i === MAX_ITERATIONS - 1) || timeLeft < 9000;
                    // Thinking mode costs ~15-18s on its own. Only allow it on the
                    // final round, and only with a safe time cushion left —
                    // otherwise the "final" call could itself blow the 30s ceiling.
                    
                 const useThinking = false;
                    const useFast = true;

                   if (isLastRound && i < MAX_ITERATIONS - 1) {
                        messages.push({ role: "user", content: '{"note": "You must respond with action: final_answer now. Do NOT call another tool. Use only the data already gathered above to answer as best you can, and lower your confidence score if some data is missing. Remember: Remember: write insight, reasoning, and recommendation in English."}' });
                    }

                    let glmResponse;
                    try {
                        glmResponse = await callGLMWithRetry(endpointUrl, authHeader, orgId, messages, {
                            fast: useFast,
                            maxTokens: 900,
                            enableThinking: useThinking
                        }, 0);
                    } catch (glmErr) {
                        console.log('DEBUG GLM call failed after retries:', glmErr.message);
                        finalAnswer = debugTrace.length
                            ? {
                                insight: `Based on available data: ${JSON.stringify(debugTrace[debugTrace.length - 1].result)}`,
                                reasoning: ['The AI service is currently slow to respond; this is a best-effort summary based on the data already retrieved.'],
                                recommendation: 'Please try again in a moment.',
                                confidence: 30,
                                dashboardAction: { type: 'none' }
                              }
                            : {
                                insight: 'The AI service is currently unavailable or slow to respond.',
                                reasoning: ['Could not get a response from the analysis engine.'],
                                recommendation: 'Please try again in a moment.',
                                confidence: 10,
                                dashboardAction: { type: 'none' }
                              };
                        break;
                    }
console.log('DEBUG full glmResponse (round ' + i + ', isLastRound=' + isLastRound + '):', JSON.stringify(glmResponse));
                    const raw = fixMojibake(stripThink(glmResponse.response || ''), isNonLatin);
                    const parsedJSON = extractJSON(raw);

                    if (!parsedJSON) {
                        console.log('DEBUG extractJSON failed. raw length:', raw.length, 'raw:', raw);
                        debugTrace.push({ note: 'JSON_PARSE_FAILED', rawLength: raw.length, rawSample: raw.slice(0, 500) });

                        const toolResults = debugTrace.filter(t => t.result !== undefined);
                        if (toolResults.length > 0) {
                            const lastResult = toolResults[toolResults.length - 1].result;
                            finalAnswer = buildAnswerFromToolResult(lastResult);
                        } else {
                            finalAnswer = {
                                insight: 'Partial analysis only — the query needed more data than time allowed.',
                                reasoning: ['The AI was still gathering data when the time budget ran out.'],
                                recommendation: 'Try a more specific question (name a district or crime type) for a faster, complete answer.',
                                confidence: 25,
                                dashboardAction: { type: 'none' }
                            };
                        }
                        break;
                    }
if (parsedJSON.action === 'call_tool') {
                        if (!isLastRound) {
                            const toolFn = TOOLS[parsedJSON.tool];
                            messages.push({ role: "assistant", content: JSON.stringify(parsedJSON) });

                            if (!toolFn) {
                                messages.push({ role: "user", content: JSON.stringify({ error: `Unknown tool: ${parsedJSON.tool}` }) });
                                continue;
                            }

                            // Detect the model repeating an identical tool call it already made.
                            // Instead of hitting the database again and hoping the next round
                            // is different, force it to notice it already has the data.
                            const alreadyCalled = debugTrace.some(t =>
                                t.tool === parsedJSON.tool && JSON.stringify(t.params) === JSON.stringify(parsedJSON.params)
                            );

                            if (alreadyCalled) {
                                // The model is stuck repeating an identical tool call and won't
                                // self-correct from an injected note (low temperature makes it
                                // over-commit to its own pattern). Stop asking it nicely and just
                                // end the loop here, synthesizing a real answer from the data
                                // already fetched instead of burning more rounds on a retry that
                                // won't work.
                                const lastResult = debugTrace[debugTrace.length - 1].result;
                                finalAnswer = buildAnswerFromToolResult(lastResult);
                                break;
                            }

                            try {
                                const toolResult = await toolFn(zcql, parsedJSON.params, districtNameToId, crimeTypeMap);
                                debugTrace.push({ tool: parsedJSON.tool, params: parsedJSON.params, result: toolResult });
                                messages.push({ role: "user", content: `Tool result: ${JSON.stringify(toolResult)}` });
                            } catch (toolErr) {
                                messages.push({ role: "user", content: JSON.stringify({ error: toolErr.message }) });
                            }
                            continue;
                        }

                        // Model tried to call another tool on the forced-final round.
                        // Give it exactly one more strict attempt to produce a real final_answer
                        // using whatever data we already have, instead of dumping raw JSON.
                        if (timeLeft > 4000) {
                            try {
                                const toolFn = TOOLS[parsedJSON.tool];
                                if (toolFn) {
                                    const toolResult = await toolFn(zcql, parsedJSON.params, districtNameToId, crimeTypeMap);
                                    debugTrace.push({ tool: parsedJSON.tool, params: parsedJSON.params, result: toolResult });
                                    messages.push({ role: "assistant", content: JSON.stringify(parsedJSON) });
                                    messages.push({ role: "user", content: `Tool result: ${JSON.stringify(toolResult)}` });
                                }
                            } catch (e) { /* ignore, fall through */ }

                            messages.push({ role: "user", content: '{"note": "STOP. You must respond with {\\"action\\": \\"final_answer\\", ...} right now using the data already gathered. Do NOT request another tool call. This is your last chance to answer."}' });

                            try {
                                const retryResponse = await callGLM(endpointUrl, authHeader, orgId, messages, {
                                    fast: true,
                                    maxTokens: isNonLatin ? 4500 : 900,
                                    enableThinking: false
                                });
                                const retryRaw = fixMojibake(stripThink(retryResponse.response || ''), isNonLatin);
                                const retryParsed = extractJSON(retryRaw);
                                if (retryParsed && retryParsed.action === 'final_answer') {
                                    finalAnswer = retryParsed;
                                    break;
                                }
                            } catch (e) { /* fall through to summary below */ }
                        }

                        // Absolute last resort: build a plain-language summary instead of raw JSON
                        if (debugTrace.length > 0) {
                            const lastResult = debugTrace[debugTrace.length - 1].result;
                            const parts = [];
                            if (typeof lastResult.total === 'number') parts.push(`Total: ${lastResult.total}`);
                            if (Array.isArray(lastResult.byType)) {
                                parts.push(lastResult.byType.slice(0, 3).map(t => `${t.crimeType}: ${t.count}`).join(', '));
                            }
                            finalAnswer = {
                                insight: parts.length ? parts.join('. ') : 'Data was gathered but a complete answer could not be generated in time.',
                                reasoning: ['The AI gathered relevant data but ran out of time to fully reason through it; this is a simplified summary.'],
                                recommendation: 'Try a more specific question (name a district or crime type) for a faster, complete answer.',
                                confidence: 35,
                                dashboardAction: { type: 'none' }
                            };
                        } else {
                            finalAnswer = {
                                insight: 'Partial analysis only - the query needed more data than time allowed.',
                                reasoning: ['The AI was still gathering data when the time budget ran out.'],
                                recommendation: 'Try a more specific question (name a district or crime type) for a faster, complete answer.',
                                confidence: 25,
                                dashboardAction: { type: 'none' }
                            };
                        }
                        break;
                    }

                                      if (parsedJSON.action === 'propose_action') {
                        finalAnswer = parsedJSON;
                        break;
                    }
                    if (parsedJSON.action === 'final_answer') {
                        finalAnswer = parsedJSON;
                        break;
                    }

                    finalAnswer = {
                        insight: 'Partial analysis only — the query needed more data than time allowed.',
                        reasoning: ['The AI was still gathering data when the time budget ran out.'],
                        recommendation: 'Try a more specific question (name a district or crime type) for a faster, complete answer.',
                        confidence: 25,
                        dashboardAction: { type: 'none' }
                    };
                    break;
                }

                if (!finalAnswer) {
                    finalAnswer = {
                        insight: 'Unable to complete analysis within the allotted steps.',
                        reasoning: ['The query required more tool calls than allowed.'],
                        recommendation: 'Try asking a more specific question (e.g. name a district or crime type).',
                        confidence: 20,
                        dashboardAction: { type: 'none' }
                    };
                }
		

                if (isNonLatin && finalAnswer && finalAnswer.insight) {
    try {
        const translated = await translateFinalAnswerToKannada(authHeader, orgId, finalAnswer);
        if (translated && translated.insight) {
                            finalAnswer._english = {
                                insight: finalAnswer.insight,
                                reasoning: finalAnswer.reasoning,
                                recommendation: finalAnswer.recommendation
                            };
                            finalAnswer.insight = translated.insight;
                            finalAnswer.reasoning = translated.reasoning || finalAnswer.reasoning;
                            finalAnswer.recommendation = translated.recommendation || finalAnswer.recommendation;
                        }
                    } catch (translateErr) {
                        // Translation failed — keep the English version rather than fail the whole request
                    }
                }
		finalAnswer._debug = { knownCrimeTypes, trace: debugTrace, translatedQuestion: isNonLatin ? questionForModel : null };

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.write(JSON.stringify(finalAnswer));
                res.end();
            } catch (innerErr) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.write(JSON.stringify({ error: innerErr.message, stack: innerErr.stack }));
                res.end();
            }
        });
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.write(JSON.stringify({ error: err.message }));
        res.end();
    }
};





















