/**
 * SMC - Parser
 * Copyright(c) 2010 ~ 2012 Alibaba.com, Inc.
 * MIT Licensed
 */

var path = require('path'),
	url = require('url'),
	util = require('./util');

var	PATTERN_COMMENT = /\/\/.*$|\/\*[\s\S]*?\*\//gm,

	PATTERN_ID = /(['"])(.*?)(['"])/g,

	PATTERN_EXTNAME = /\.(?:css|js)$/,

	PATTERN_REQUIRE = /[^\.]require\s*\(\s*['"](.*?)['"]\s*\)/gm,

	PATTERN_SEARCH = /\?.*$/,

	PATTERN_SLASH = /\\/g,

	PATTERN_STATEMENT = /([^\.])((?:seajs\.use|require|require\.async)\s*\(\s*\[?)(.*?)(\]?\s*\))/g,

	PATTERN_VERSIONED_ID = /^(.*?)\/(\d+\.\d+\.\d+[\+\-]?)(?:\/(.*))?$/,

	// Parser constructor.
	Parser = util.inherit(Object, {
		/**
		 * Initializer.
		 * @param config {Object}
		 */
		_initialize: function (config) {
			this._config = config;
		},

		/**
		 * Resolve alias.
		 * @param file {Object}
		 */
		alias2Id: function (file) {
			var config = this._config,
				alias = file.alias;

			file.data = file.data.replace(PATTERN_STATEMENT, function (all, prefix, lStatement, id, rStatement) {
				id = id.replace(PATTERN_ID, function (all, lQuote, id, rQuote) {
					var parts, first, pathname, re;

					if (id !== '$' && id.charAt(0) !== '#') {
						parts = id.split('/');
						first = parts[0];

						if (alias.hasOwnProperty(first)) {
							parts[0] = alias[first];
							id = parts.join('/');
						}

						if (first === '.') { // Resolve related pathname.
							id = decodeURI(url.resolve(file.pathname, id))
									.replace(config.base, '');
						}

						re = id.match(PATTERN_VERSIONED_ID);

						if (re && !re[3]) { // Resolve versioned id without suffix.
							id = re[1] + '/' + re[2] + '/' + re[1].split('/').pop();
						}

						// Resolved id should start with #.
						id = '#' + id;
					}

					return lQuote + id + rQuote;
				});

				return prefix + lStatement + id + rStatement;
			});
		},

		/**
		 * Convert seajs id to pathname.
		 * @param id {string}
		 * @return {string}
		 */
		id2Pathname: function (id) {
			var config = this._config,
				last = id.charAt(id.length - 1),
				re;

			if (id.charAt(0) === '#') {
				id = id.substring(1);

				if (last === '#') {
					id = id.slice(0, -1);
				} else if (last !== '/' && id.indexOf('?') === -1 && !PATTERN_EXTNAME.test(id)) {
					id += '.js';
				}

				// Remove params.
				id = id.replace(PATTERN_SEARCH, '');

				// Resolve relative pathname and correct slash in Windows.
				id = path.normalize(id).replace(PATTERN_SLASH, '/');

				id = config.base + id;
			}

			return id;
		},

		/**
		 * Parse shallow dependencies.
		 * @param file {Object}
		 */
		parseDependencies: function (file) {
			var data = file.data,
				deps = [],
				re;

			PATTERN_REQUIRE.lastIndex = 0;

			data = data.replace(PATTERN_COMMENT, '');

			while (re = PATTERN_REQUIRE.exec(data)) { // Assign.
				deps.push(this.id2Pathname(re[1]));
			}

			file.deps = deps;
		}
	});

module.exports = Parser;
