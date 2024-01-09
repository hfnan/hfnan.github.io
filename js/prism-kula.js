Prism.languages.kula = Prism.languages.extend('clike', {
	'string': {
		pattern: /(["'`])(?:\\[\s\S]|(?!\1)[^\\])*\1/,
		greedy: true
	},
	'comment': /#.*\n/,
	'keyword': /\b(?:if|else|for|while|func|return|break|continue)\b/,
	'number': /[0-9]+(.[0-9]*)?/i,
	'class-name': /(?:[A-Z]\w*(?=\.))/,
});