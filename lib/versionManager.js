/**
 * SMC - VersionManager
 * Copyright(c) 2010 ~ 2012 Alibaba.com, Inc.
 * MIT Licensed
 */

var util = require('./util');

var PATTERN_VERSIONED_ID = /^(.*?)\/(\d+\.\d+\.\d+)([\+\-]?)\/(.*)$/,

	PATTERN_VERSION = /^(\d+\.\d+\.\d+)([\+\-]?)$/,

	NEGATIVE_INFINITY = Number.NEGATIVE_INFINITY,

	POSITIVE_INFINITY = Number.POSITIVE_INFINITY,

	/**
	 * Version comparing function.
	 * @param ver1 {string}
	 * @param ver2 {string}
	 * @return {number}
	 */
	compare = function (ver1, ver2) {
		var i;

		ver1 = toNumber(ver1);
		ver2 = toNumber(ver2);

		for (i = 0; i < 3; ++i) {
			if (ver1[i] === ver2[i]) {
				continue;
			} else {
				return ver1[i] < ver2[i] ? -1 : 1;
			}

			return 0;
		}
	},

	/**
	 * Test whether versions is compatible.
	 * @param versions {string}
	 * @return {boolean}
	 */
	compatible = function (versions) {
		var len = versions.length,
			i = 0,
			subset = [ NEGATIVE_INFINITY, POSITIVE_INFINITY ];

		for (; i < len; ++i) {
			subset = intersect(subset, versions[i]);
			if (!subset) {
				return false;
			}
		}

		return true;
	},

	/**
	 * Compute intersection.
	 * @param section {Array}
	 * @param ver {string}
	 * @return {Array}
	 */
	intersect = function (section, ver) {
		var re = ver.match(PATTERN_VERSION),
			point = re[1],
			direction = re[2],
			l = compare(point, section[0]),
			h = compare(point, section[1]);

		if (direction === '') {
			if (l === -1 || h === 1) { // . [ ] or [ ] .
				return null;
			} else { // [ . ]
				return [ point, point ];
			}
		}

		if (direction === '+') {
			if (h === 1) { // [ ] +
				return null;
			} else if (l === -1) { // + [ ]
				return section;
			} else { // [ + ]
				return [ point, section[1] ];
			}
		}

		if (direction === '-') {
			if (l === -1) { // - [ ]
				return null;
			} else if (h === 1) { // [ ] -
				return section;
			} else { // [ - ]
				return [ section[0], point ];
			}
		}
	},

	/**
	 * Parse versioned pathname.
	 * @param pathnames {Array}
	 * @param trace {Array}
	 * @return {Array}
	 */
	parse = function (pathname, trace) {
		var re = pathname.match(PATTERN_VERSIONED_ID);

		if (re) {
			pathname = resolve(re[1], re[2], re[3], re[4], trace);
		}

		return pathname;
	},

	/**
	 * Resolve ranged version number.
	 * @param prefix {string}
	 * @param ver {string}
	 * @param range {string}
	 * @param suffix {string}
	 * @return {string|null}
	 */
	resolve = function (prefix, ver, range, suffix, trace) {
		var versions = trace
				.map(function (file) {
					return file.versionMap[prefix];
				})
				.filter(function (ver) {
					return !!ver;
				}),
			i, err;

		if (!compatible(versions)) {
			err = new Error(util.format(
				'Version of "%s" conflicts: %s',
				prefix,
				trace.map(function (file) {
					return file.pathname
						+ '(' + (file.versionMap[prefix] || '*') + ')';
				}).join(' -> ')
			));
			err.code = 'EVERCONF';
			throw err;
		}

		i = versions.length;

		while (--i >= 0) { // Resolve version.
			if (range === '') {
				break;
			}

			re = versions[i].match(PATTERN_VERSION);

			if (re[2] === '') {
				ver = re[1];
				range = re[2];
			}
		}

		return range === '' ?
			prefix + '/' + ver + '/' + suffix : // Resolved.
			null; // Not resolved.
	},

	/**
	 * Convert version string to numbers.
	 * @param ver {string}
	 * @return {Array}
	 */
	toNumber = function (ver) {
		if (ver === NEGATIVE_INFINITY || ver === POSITIVE_INFINITY) {
			ver = [ ver, ver, ver ];
		} else {
			ver = ver.split('.').map(function (value) {
				return parseInt(value, 10);
			});
		}

		return ver;
	};

exports.parse = parse;
