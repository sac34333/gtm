-- Refinement options table
-- Stores chips, strength descriptors, and keep-toggles used by the
-- "Refine Image" panel. Editable per-org without code changes.
-- option_type: 'chip' | 'strength' | 'toggle'
-- option_key: stable identifier used in code joins (e.g. 'too_dark', 'strength_3', 'keep_colours')
-- label: short user-visible text on the chip/toggle
-- instruction_text: the imperative sentence(s) appended to the model prompt
-- position: display order within type
-- is_active: soft-delete flag
-- org_id NULL = global default; org-specific rows override globals on (option_type, option_key).

CREATE TABLE refinement_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  option_type text NOT NULL CHECK (option_type IN ('chip', 'strength', 'toggle')),
  option_key text NOT NULL,
  label text NOT NULL,
  instruction_text text NOT NULL,
  position int NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, option_type, option_key)
);

CREATE INDEX refinement_options_lookup_idx
  ON refinement_options (option_type, position)
  WHERE is_active = true;

ALTER TABLE refinement_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY refinement_options_select
  ON refinement_options FOR SELECT
  TO authenticated
  USING (
    org_id IS NULL
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY refinement_options_insert
  ON refinement_options FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    AND EXISTS (
      SELECT 1 FROM org_members
      WHERE user_id = auth.uid()
        AND org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY refinement_options_update
  ON refinement_options FOR UPDATE
  TO authenticated
  USING (
    org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    AND EXISTS (
      SELECT 1 FROM org_members
      WHERE user_id = auth.uid()
        AND org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY refinement_options_delete
  ON refinement_options FOR DELETE
  TO authenticated
  USING (
    org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    AND EXISTS (
      SELECT 1 FROM org_members
      WHERE user_id = auth.uid()
        AND org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
        AND role IN ('owner', 'admin')
    )
  );

CREATE OR REPLACE FUNCTION set_refinement_options_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER refinement_options_set_updated_at
  BEFORE UPDATE ON refinement_options
  FOR EACH ROW EXECUTE FUNCTION set_refinement_options_updated_at();

INSERT INTO refinement_options (org_id, option_type, option_key, label, instruction_text, position) VALUES
  (NULL, 'chip', 'too_dark',           'Too dark',           'Brighten the image. Lift shadows and increase exposure. Keep composition and subject identical.', 10),
  (NULL, 'chip', 'too_light',          'Too light',          'Reduce exposure. Deepen shadows and add richer tones. Keep composition and subject identical.', 20),
  (NULL, 'chip', 'too_busy',           'Too busy',           'Simplify the scene. Remove background clutter and small distracting objects. Add negative space. Do not change the main subject.', 30),
  (NULL, 'chip', 'too_plain',          'Too plain',          'Add subtle visual interest — props, depth, or background detail — without changing the main subject.', 40),
  (NULL, 'chip', 'wrong_colours',      'Wrong colours',      'Recolour the scene to align with the brand palette already provided. Keep all shapes and composition identical.', 50),
  (NULL, 'chip', 'not_on_brand',       'Not on-brand',       'Adjust styling, props and finish so the image feels aligned with the brand identity. Keep the main subject in place.', 60),
  (NULL, 'chip', 'change_background',  'Change background',  'Replace the background only. Keep the main subject in the same position, scale and pose.', 70),
  (NULL, 'chip', 'different_mood',     'Different mood',     'Shift the lighting and atmosphere to a different mood. Keep the main subject and composition.', 80),
  (NULL, 'chip', 'more_professional',  'More professional',  'Make the image feel more corporate and polished — cleaner styling, calmer palette, more business-appropriate.', 90),
  (NULL, 'chip', 'more_bold',          'More bold',          'Increase contrast and visual punch. Make the image more striking. Keep the main subject.', 100),
  (NULL, 'chip', 'add_text_overlay',   'Add text overlay',   'Add the CTA text already provided as a clean, legible overlay on the image. Use brand colours.', 110),
  (NULL, 'chip', 'remove_text',        'Remove text',        'Remove all text and typography from the image. Keep everything else identical.', 120),
  (NULL, 'chip', 'different_style',    'Different style',    'Reinterpret in a different visual style while preserving the subject, layout and message.', 130),
  (NULL, 'strength', 'strength_1', 'Tiny tweak',     'Edit only the specified aspect: [chips selected]. Keep everything else pixel-faithful to the original.', 1),
  (NULL, 'strength', 'strength_2', 'Small change',   'Make small adjustments. Preserve composition, subject, lighting and palette except where requested.', 2),
  (NULL, 'strength', 'strength_3', 'Moderate',       'Moderate edit — change the requested aspects clearly while keeping the core composition and subject.', 3),
  (NULL, 'strength', 'strength_4', 'Significant',    'Significant rework — reimagine the requested aspects, but keep the same subject and overall message.', 4),
  (NULL, 'strength', 'strength_5', 'Reimagine',      'Reimagine substantially. Keep only the core subject and message; everything else can change.', 5),
  (NULL, 'toggle', 'keep_colours', 'Keep my brand colours', 'Keep the brand colours.', 10),
  (NULL, 'toggle', 'keep_subject', 'Keep the main subject', 'Keep the main subject/element in the same position.', 20);
