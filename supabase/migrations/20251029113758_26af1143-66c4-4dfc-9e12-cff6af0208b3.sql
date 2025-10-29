-- Add new columns to leads table for AI analysis
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS niche text,
ADD COLUMN IF NOT EXISTS last_posted timestamp with time zone,
ADD COLUMN IF NOT EXISTS ability_to_pay_analysis text,
ADD COLUMN IF NOT EXISTS youtube_url text;

-- Update templates table with new default template
INSERT INTO public.templates (name, subject, body, user_id)
SELECT 
  'Default Outreach Template',
  'Quick question about {{channel_name}}',
  E'Hey {{name}},\n\nI checked out your channel — {{channel_name}} — love your {{platform}} content!\nI noticed your videos could pop even more with professional editing + custom thumbnails.\n\nWould you be interested in a free sample edit?\n\nBest,\nMax',
  id
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM public.templates WHERE name = 'Default Outreach Template'
)
LIMIT 1;