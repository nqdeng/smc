/**
 * SMC - Loader
 * Copyright(c) 2010 ~ 2012 Alibaba.com, Inc.
 * MIT Licensed
 */

var url = require('url'),
	util = require('./util');

var PATTERN_VERSIONED_ID = /^(.*?)\/(\d+\.\d+\.\d+[\+\-]?)/,

	// Loader constructor.
	Loader = util.inherit(Object, {
		/**
		 * Initializer.
		 * @param config {Object}
		 */
		_initialize: function (config) {
			this._config = config;
			this._fileCache = {};
			this._packageCache = {};
		},

		/**
		 * Generate version map from alias.
		 * @param alias {Object}
		 * @return {Object}
		 */
		_generateVersionMap: function (alias) {
			var config = this._config,
				map = {};

			util.each(alias, function (value) {
				var re = value.match(PATTERN_VERSIONED_ID);

				if (re) {
					map[config.base + re[1]] = re[2];
				}
			});

			return map;
		},

		/**
		 * Load package file.
		 * @param pathname {string}
		 * @param callback {Function}
		 */
		_loadPackage: function (pathname, callback) {
			var config = this._config,
				packageCache = this._packageCache,
				startDir = decodeURI(url.resolve(pathname, './')),
				self =  this;

			if (startDir in packageCache) {
				callback(null, packageCache[startDir]);
			} else {
				(function next(dirname) {
					var pathname = decodeURI(url.resolve(dirname, 'package.json'));

					config.fileLoader.load(pathname, function (err, file) {
						var pkg;

						if (err) {
							if (dirname !== '/') {
								next(decodeURI(url.resolve(dirname, '../')));
							} else {
								packageCache[startDir] = { alias: {}, versionMap: {} };
								callback(null, packageCache[startDir]);
							}
						} else {
							try {
								pkg = JSON.parse(file.data);
							} catch (err) {
								callback(err);
							}

							pkg.alias = pkg.alias || {};
							pkg.versionMap = self._generateVersionMap(pkg.alias);
							packageCache[startDir] = pkg;

							callback(null, pkg);
						}
					});
				}(startDir));
			}
		},

		/**
		 * Load file and corresponding package file.
		 * @param pathname {string}
		 * @param callback {Function}
		 */
		load: function (pathname, callback) {
			var config = this._config,
				fileCache = this._fileCache,
				self = this;

			if (fileCache[pathname]) {
				callback(null, fileCache[pathname]);
			} else {
				config.fileLoader.load(pathname, function (err, file) {
					if (err) {
						callback(err);
					} else {
						self._loadPackage(pathname, function (err, pkg) {
							if (err) {
								callback(err);
							} else {
								file.alias = pkg.alias;
								file.versionMap = pkg.versionMap;
								fileCache[pathname] = file;
								callback(null, file);
							}
						});
					}
				});
			}
		}
	});

module.exports = Loader;
