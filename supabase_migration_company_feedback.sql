CREATE TABLE company_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID,
  user_email TEXT,
  body TEXT NOT NULL,
  applied_to_model BOOLEAN DEFAULT FALSE,
  applied_to_persona_id UUID REFERENCES company_prompts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_company_feedback_company ON company_feedback(company_id);
CREATE INDEX idx_company_feedback_model ON company_feedback(company_id) WHERE applied_to_model = true;
