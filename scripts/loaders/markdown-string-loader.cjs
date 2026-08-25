"use strict";

module.exports = function markdownStringLoader(source) {
  const markdown = source.toString().replace(/\r\n/g, "\n").trim();
  return `export default ${JSON.stringify(markdown)};`;
};
