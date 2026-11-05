# Preserve Asciidoctor's normal HTML conversion while exposing its parsed index terms.
# No source prose is rewritten. Exact-location anchors make the generated index clickable.
require 'asciidoctor'
require 'asciidoctor/converter/html5'
require 'json'
class JifunzeBookHTML < Asciidoctor::Converter::Html5Converter
  register_for 'html5'
  def convert_pass(node)
    # The whitepaper's HTML passthrough contains four index macros. Process only
    # these publishing markers, retaining the HTML, MathML and prose verbatim.
    super.gsub(/\(\(\(.*?\)\)\)/m) { |term| node.apply_subs(term, [:macros]) }
  end
  def convert_inline_indexterm(node)
    terms = node.attr('terms') || [node.text]
    terms = terms.compact.reject(&:empty?)
    return super if terms.empty?
    list = ($jifunze_index ||= [])
    id = "jifunze-index-#{list.length + 1}"
    list << { id: id, terms: terms }
    "<a id=\"#{id}\"></a>#{super}"
  end
end
at_exit { File.write('/output/index.json', JSON.pretty_generate($jifunze_index || [])) }
