import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyzedLead {
  name: string;
  email: string;
  channel_name: string;
  platform: string;
  youtube_url: string;
  niche: string;
  last_posted: string;
  ability_to_pay_analysis: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { urls } = await req.json();
    console.log('Analyzing YouTube channels:', urls);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY environment variable not found');
      throw new Error('LOVABLE_API_KEY not configured');
    }
    console.log('LOVABLE_API_KEY found, proceeding with analysis');

    const systemPrompt = `You are a YouTube channel analyzer for a video editing outreach service.

FIRST: Extract all YouTube channel URLs or channel names from the provided text. Look for:
- Full URLs like youtube.com/@channelname or youtube.com/c/channelname
- Channel names mentioned (look for @ symbols or context clues)
- Any text that might reference YouTube creators

THEN: For each channel found, analyze and extract:
- Channel name
- Creator name (best guess)
- Niche/category (Gaming, Tech, Beauty, Vlog, Education, etc.)
- Estimated last post date
- Professional email (search in channel about section, common formats like contact@, business@, or name@domain)
- Ability to pay analysis (based on subscriber count, views, production quality, sponsorships visible)

CRITICAL: Return ONLY a raw JSON array, with NO markdown formatting, NO code fences, NO backticks.
Return this exact structure for each channel found:
[
  {
    "name": "Creator Name",
    "email": "contact@example.com or No email found",
    "channel_name": "Channel Name",
    "platform": "YouTube",
    "youtube_url": "full channel url",
    "niche": "Gaming/Tech/Beauty/Vlog/etc",
    "last_posted": "2025-01-15 or recent estimate",
    "ability_to_pay_analysis": "High potential - 500K subs, consistent uploads, professional production, visible sponsorships. Likely monetized and hiring editors."
  }
]

Be analytical about monetization. Look for:
- Subscriber count & engagement rate
- Production quality (professional vs amateur)
- Upload consistency
- Visible brand deals/sponsorships
- Video views compared to subs
- Comments about needing editors

If you can't find a channel or the text doesn't contain YouTube references, return an empty array []

DO NOT wrap the response in markdown code fences or backticks. Return pure JSON only.`;

    const userPrompt = `Extract and analyze all YouTube channels from this text:\n\n${urls.join('\n\n')}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    console.log('AI Response:', aiResponse);

    // Extract JSON from the response
    let analyzedLeads: AnalyzedLead[];
    try {
      // Remove markdown code fences if present
      let cleanedResponse = aiResponse.trim();
      cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '');
      cleanedResponse = cleanedResponse.replace(/^```\s*/i, '');
      cleanedResponse = cleanedResponse.replace(/\s*```$/i, '');
      cleanedResponse = cleanedResponse.trim();

      // Try to extract JSON array
      const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        analyzedLeads = JSON.parse(jsonMatch[0]);
      } else {
        analyzedLeads = JSON.parse(cleanedResponse);
      }
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      console.error('Raw AI response:', aiResponse);
      throw new Error('Failed to parse AI analysis. Please try again.');
    }

    console.log('Analyzed leads:', analyzedLeads);

    return new Response(
      JSON.stringify({ leads: analyzedLeads }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: any) {
    console.error('Error in analyze-youtube-channels:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
