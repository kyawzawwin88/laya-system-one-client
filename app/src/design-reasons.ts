export const designReasons = {
  color:
    "Ink on cool paper for a quiet operator surface; forest accent marks only the chosen answer and the top probability bar.",
  type: "System UI for the form so the page stays offline and matches the machine. ui-monospace for answer numbers so values stay scanable.",
  layout: "The page fills the screen in two columns. Request and context schema are tabs in the left column. The right column shows the read-only API request above the response. A history control opens the saved session list. Choosing an item shows that request and response, and Current response returns to the live view. Narrow screens stack that column under the form.",
  spacing: "Uniform 1rem rhythm (RHYTHM 1) with 1.5rem between form and response blocks.",
  accent: "Accent is reserved for the selected choice or score and the tallest probability bar.",
} as const;
