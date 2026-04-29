// File: /api/klaviyo-signup.js
//
// Vercel Function called by auth-callback.html during signup. Uses the
// Klaviyo server-side private key (env var KLAVIYO_PRIVATE_KEY) to:
//   1. Create or update the profile (with first_name + custom properties)
//   2. Subscribe profile to the QB BrandOS list (WSfkyj) with email consent
//   3. Fire Brand Profile Saved event
//   4. Fire Tool Completed events for every completion the user did pre-signup
//
// Server-side path bypasses Klaviyo's public-client bot protection that was
// silently suppressing browser-originated POSTs from auth-callback.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const KEY = process.env.KLAVIYO_PRIVATE_KEY;
  if (!KEY) {
    console.error('[klaviyo-signup] KLAVIYO_PRIVATE_KEY env var missing');
    return res.status(500).json({ ok: false, error: 'Server misconfigured' });
  }

  const { email, firstName, sourceTool, completions, qbp, listId } = (req.body || {});

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ ok: false, error: 'email required' });
  }

  const API = 'https://a.klaviyo.com/api';
  const REVISION = '2024-10-15';
  const LIST_ID = listId || 'WSfkyj';

  const TOOL_NAMES = {
    'archetype-compass': 'Archetype Compass',
    'brand-soul-map':    'Brand Soul Map',
    'sensescape':        'Sensescape',
    'visual-dna':        'Visual DNA',
    'war-table':         'War Table',
    'the-profiles':      'The Profiles'
  };

  const headers = {
    'Authorization': 'Klaviyo-API-Key ' + KEY,
    'Content-Type':  'application/json',
    'Accept':        'application/json',
    'revision':      REVISION
  };

  const errors = [];
  let profileId = null;

  // 1. Create or update profile
  const completionCount = completions && typeof completions === 'object'
    ? Object.keys(completions).length
    : 0;

  const profileAttributes = {
    email,
    first_name: firstName || undefined,
    properties: {
      signup_source:             sourceTool || 'unknown',
      archetype:                 (qbp && qbp.archetype)  || null,
      brand_name:                (qbp && qbp.brandName)  || null,
      tools_completed_at_signup: completionCount,
      signup_date:               new Date().toISOString().split('T')[0]
    }
  };

  try {
    const createRes = await fetch(API + '/profiles/', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        data: { type: 'profile', attributes: profileAttributes }
      })
    });

    if (createRes.status === 201) {
      const data = await createRes.json();
      profileId = data.data.id;
    } else if (createRes.status === 409) {
      // Already exists. Klaviyo returns the existing ID in errors[0].meta.duplicate_profile_id
      const conflict = await createRes.json();
      profileId = conflict?.errors?.[0]?.meta?.duplicate_profile_id || null;
      if (profileId) {
        const patchRes = await fetch(API + '/profiles/' + profileId + '/', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            data: { type: 'profile', id: profileId, attributes: profileAttributes }
          })
        });
        if (!patchRes.ok) {
          errors.push({ step: 'patch_profile', status: patchRes.status, body: await patchRes.text() });
        }
      } else {
        errors.push({ step: 'create_profile', status: 409, body: 'no duplicate_profile_id in conflict response' });
      }
    } else {
      errors.push({ step: 'create_profile', status: createRes.status, body: await createRes.text() });
    }
  } catch (e) {
    errors.push({ step: 'create_profile', error: e.message });
  }

  // 2. Subscribe to list (with email marketing consent)
  try {
    const subRes = await fetch(API + '/profile-subscription-bulk-create-jobs/', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        data: {
          type: 'profile-subscription-bulk-create-job',
          attributes: {
            custom_source: 'Brand Profile Gate',
            profiles: {
              data: [{
                type: 'profile',
                attributes: {
                  email,
                  subscriptions: {
                    email: { marketing: { consent: 'SUBSCRIBED' } }
                  }
                }
              }]
            }
          },
          relationships: {
            list: { data: { type: 'list', id: LIST_ID } }
          }
        }
      })
    });
    if (subRes.status !== 202 && !subRes.ok) {
      errors.push({ step: 'subscribe', status: subRes.status, body: await subRes.text() });
    }
  } catch (e) {
    errors.push({ step: 'subscribe', error: e.message });
  }

  // 3. Fire Brand Profile Saved event
  try {
    const bpsRes = await fetch(API + '/events/', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        data: {
          type: 'event',
          attributes: {
            metric:  { data: { type: 'metric',  attributes: { name: 'Brand Profile Saved' } } },
            profile: { data: { type: 'profile', attributes: { email } } },
            properties: {
              source_tool:     sourceTool || 'unknown',
              tools_completed: completionCount
            }
          }
        }
      })
    });
    if (bpsRes.status !== 202 && !bpsRes.ok) {
      errors.push({ step: 'event_bps', status: bpsRes.status, body: await bpsRes.text() });
    }
  } catch (e) {
    errors.push({ step: 'event_bps', error: e.message });
  }

  // 4. Fire Tool Completed for every pre-signup completion
  if (completions && typeof completions === 'object') {
    for (const toolId of Object.keys(completions)) {
      try {
        const tcRes = await fetch(API + '/events/', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            data: {
              type: 'event',
              attributes: {
                metric:  { data: { type: 'metric',  attributes: { name: 'Tool Completed' } } },
                profile: { data: { type: 'profile', attributes: { email } } },
                properties: {
                  tool_id:   toolId,
                  tool_name: TOOL_NAMES[toolId] || toolId
                }
              }
            }
          })
        });
        if (tcRes.status !== 202 && !tcRes.ok) {
          errors.push({ step: 'event_tc_' + toolId, status: tcRes.status, body: await tcRes.text() });
        }
      } catch (e) {
        errors.push({ step: 'event_tc_' + toolId, error: e.message });
      }
    }
  }

  if (errors.length > 0) {
    console.warn('[klaviyo-signup] partial failures', JSON.stringify({ email, errors }));
    return res.status(207).json({ ok: false, profileId, errors });
  }

  return res.status(200).json({ ok: true, profileId });
}
