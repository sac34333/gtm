// Refinement chip labels and their prompt injection strings.
// Frontend-only — no DB or Edge Function changes required.

export const REFINEMENT_CHIP_MAP: Record<string, string> = {
  'Too dark':
    'Increase brightness and lighting significantly. Make the image brighter and more vivid.',
  'Too light':
    'Reduce brightness. Make the image moodier and deeper with richer tones.',
  'Too busy':
    'Simplify the composition. Remove clutter. Use more negative space. Make it cleaner.',
  'Too plain':
    'Add more visual interest, depth, and detail to the composition.',
  'Wrong colours':
    'Adjust the colour palette to better match the brand guidelines.',
  'Not on-brand':
    'Make the image feel more aligned with the brand identity and visual style provided.',
  'Change background':
    'Use a different background — cleaner, more abstract, or more appropriate to the subject.',
  'Different mood':
    'Change the overall mood and feeling of the image significantly.',
  'More professional':
    'Make the image feel more corporate, polished, and business-appropriate.',
  'More bold':
    'Make the image more striking, high-contrast, and visually bold.',
  'Add text overlay':
    'Add a subtle text overlay or call-to-action area to the image.',
  'Remove text':
    'Remove any text or typography from the image entirely.',
  'Different style':
    'Change the visual style while keeping the core subject and message.',
}

export const STRENGTH_INSTRUCTIONS: Record<number, string> = {
  1: 'Keep as close to the original as possible, only change [chips selected].',
  2: 'Make minor adjustments while preserving the overall feel.',
  3: 'Moderate changes — improve the areas mentioned while keeping the core concept.',
  4: 'Significant changes — feel free to reimagine these aspects substantially.',
  5: 'Feel free to reimagine this significantly, keeping the core subject.',
}
