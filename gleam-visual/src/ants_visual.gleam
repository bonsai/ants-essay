import gleam/dynamic
import gleam/json
import gleam/list
import ontology_data

pub type Concept {
  Concept(
    id: Int,
    domain: String,
    key: String,
    name_ja: String,
    name_en: String,
    description: String,
    layer: Int,
    source: String,
  )
}

pub fn main() {
  let decoded = json.decode(ontology_data.ontology_json, decoder())
  case decoded {
    Ok(concepts) -> render(concepts)
    Error(_) -> log_error("decode failed")
  }
}

fn decoder() {
  dynamic.field("concepts", dynamic.list(concept_decoder()))
}

fn concept_decoder() {
  dynamic.decode8(
    Concept,
    dynamic.field("id", dynamic.int),
    dynamic.field("domain", dynamic.string),
    dynamic.field("key", dynamic.string),
    dynamic.field("name_ja", dynamic.string),
    dynamic.field("name_en", dynamic.string),
    dynamic.field("description", dynamic.string),
    dynamic.field("layer", dynamic.int),
    dynamic.field("source", dynamic.string),
  )
}

@external(javascript, "./ants_visual_ffi.mjs", "render")
pub fn render(concepts: List(Concept)) -> Nil

@external(javascript, "./ants_visual_ffi.mjs", "logError")
pub fn log_error(msg: String) -> Nil
