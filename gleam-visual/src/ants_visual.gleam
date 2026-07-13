import ontology_data

pub fn main() {
  let concepts = ontology_data.all_concepts()
  render(concepts)
}

@external(javascript, "./ants_visual_ffi.mjs", "render")
pub fn render(concepts: List(ontology_data.Concept)) -> Nil
