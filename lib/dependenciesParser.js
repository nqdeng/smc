/**
 * SMC - DependenciesParser
 * Copyright(c) 2010 ~ 2012 Alibaba.com, Inc.
 * MIT Licensed
 */

var path = require('path'),
	url = require('url');

var PATTERN_REQUIRE = /(?:^|[^\.])require\s*\(\s*['"]#(.*?)['"]\s*\)/gm,

	PATTERN_COMMENT = /\/\/.*$|\/\*[\s\S]*?\*\//gm,

	PATTERN_EXTNAME = /\.(?:css|js)$/,

	PATTERN_VERSIONED_ID = /^(.*?)\/(\d+\.\d+\.\d+[\+\-]?)(?:\/(.*))?$/,

	PATTERN_SEARCH = /\?.*$/,

	PATTERN_SLASH = /\\/g,

	/**
	 * Convert seajs id to pathname.
	 * @param id {string}
	 * @return {string}
	 */
	normalize = function (id) {
		var last = id.charAt(id.length - 1),
			re;

		if (last === '#') {
			id = id.slice(0, -1);
		} else {
			re = id.match(PATTERN_VERSIONED_ID);

			if (re && !re[3]) { // Versioned pathname without suffix.
				id = re[1] + '/' + re[2] + '/' + re[1].split('/').pop();
			}

			if (last !== '/' && id.indexOf('?') === -1 && !PATTERN_EXTNAME.test(id)) {
				id += '.js';
			}
		}

		// Remove params.
		id = id.replace(PATTERN_SEARCH, '');

		// Resolve relative pathname and correct slash in Windows.
		id = path.normalize(id).replace(PATTERN_SLASH, '/');

		return id;
	},

	/**
	 * Parse shallow dependencies.
	 * @param file {Object}
	 * @param base {string}
	 */
	parse = function (file, base) {
		var data = file.data,
			deps = [],
			re, id;

		PATTERN_REQUIRE.lastIndex = 0;

		data = data.replace(PATTERN_COMMENT, '');

		while (re = PATTERN_REQUIRE.exec(data)) {
			id = base + re[1];
			deps.push(normalize(id));
		}

		file.deps = deps;
	};

exports.parse = parse;
