/**
 * SMC - Utility
 * Copyright(c) 2010 ~ 2012 Alibaba.com, Inc.
 * MIT Licensed
 */

var toString = Object.prototype.toString,

	slice = Array.prototype.slice,

	// Inherit from native utility.
	util = Object.create(require('util')),

	/**
	 * Format printf-like string.
	 * @param template {string}
	 * @param value {**}
	 * @return {string}
	 */
	format = util.format,

	/**
	 * Test whether type of input value is Array.
	 * @param value {*}
	 * @return {boolean}
	 */
	isArray = util.isArray,

	/**
	 * Test whether type of input value is Boolean.
	 * @param value {*}
	 * @return {boolean}
	 */
	isBoolean = util.isBoolean = function (value) {
		return typeof value === 'boolean';
	},

	/**
	 * Test whether type of input value is Date.
	 * @param value {*}
	 * @return {boolean}
	 */
	isDate = util.isDate,

	/**
	 * Test whether type of input value is Error.
	 * @param value {*}
	 * @return {boolean}
	 */
	isError = util.isError,

	/**
	 * Test whether type of input value is Function.
	 * @param value {*}
	 * @return {boolean}
	 */
	isFunction = util.isFunction = function (value) {
		return typeof value === 'function';
	},

	/**
	 * Test whether type of input value is Null.
	 * @param value {*}
	 * @return {boolean}
	 */
	isNull = util.isNull = function (value) {
		return value === null;
	},

	/**
	 * Test whether type of input value is Number.
	 * @param value {*}
	 * @return {boolean}
	 */
	isNumber = util.isNumber = function (value) {
		return typeof value === 'number' && isFinite(value);
	},

	/**
	 * Test whether type of input value is Object.
	 * @param value {*}
	 * @return {boolean}
	 */
	isObject = util.isObject = function (value) {
		return value === Object(value);
	},

	/**
	 * Test whether type of input value is RegExp.
	 * @param value {*}
	 * @return {boolean}
	 */
	isRegExp = util.isRegExp,

	/**
	 * Test whether type of input value is String.
	 * @param value {*}
	 * @return {boolean}
	 */
	isString = util.isString = function (value) {
		return typeof value === 'string';
	},

	/**
	 * Test whether type of input value is Undefined.
	 * @param value {*}
	 * @return {boolean}
	 */
	isUndefined = util.isUndefined = function(value) {
		return typeof value === 'undefined';
	},

	/**
	 * Convert array-like object to array.
	 * @param value {*}
	 * @return {boolean}
	 */
	toArray = util.toArray = function (obj) {
		return slice.call(obj);
	},

	/**
	 * Get type of input value.
	 * Copyright 2011 Yahoo! Inc. All rights reserved.
	 * @param value {*}
	 * @return {string}
	 */
	type = util.type = (function () {
		var TYPES = {
			'undefined'        : 'undefined',
			'number'           : 'number',
			'boolean'          : 'boolean',
			'string'           : 'string',
			'[object Function]': 'function',
			'[object RegExp]'  : 'regexp',
			'[object Array]'   : 'array',
			'[object Date]'    : 'date',
			'[object Error]'   : 'error'
		};
		return function (value) {
			return TYPES[typeof value]
				|| TYPES[toString.call(value)]
				|| (value ? 'object' : 'null');
		};
	}()),

	/**
	 * Create a child object or constructor.
	 * @param parent {Object|Function}
	 * @param methods {Object}
	 * @param properties {Object}
	 * @return {Object|Function}
	 */
	inherit = util.inherit = function (parent, methods, properties) {
		var child;

		if (isFunction(parent)) {
			child = function () {
				if (isFunction(this._initialize)) {
					this._initialize.apply(this, arguments);
				}
			};
			child.prototype = inherit(parent.prototype, isObject(methods) ?
				mix(methods, { constructor: child }) :  { constructor: child }, properties);
			// Mimic behavior of native Function.prototype.
			Object.defineProperty(child.prototype, 'constructor', { enumerable: false });
			child.superclass = parent.prototype;
			child.extend = inherit.bind(util, child);
		} else if (isObject(parent)) {
			child = Object.create(parent, properties);
			if (isObject(methods)) {
				mix(child, methods, false);
			}
		}

		return child;
	},

	/**
	 * Shallow copy properties from souce object to target object.
	 * @param target {Object}
	 * @param source {Object+}
	 * @param [override=true] {boolean}
	 * @return {Object}
	 */
	mix = util.mix = function () {
		var args = toArray(arguments),
			target = args.shift() || {},
			overwrite = isBoolean(args[args.length - 1]) ? args.pop() : true;

		args.forEach(function (source) {
			if (source) {
				each(source, function (value, key) {
					if (!target.hasOwnProperty(key) || overwrite) {
						target[key] = value;
					}
				});
			}
		});

		return target;
	},

	/**
	 * Shallow copy properties from souce object to new-created empty object.
	 * @param source {Object+}
	 * @return {Object}
	 */
	merge = util.merge = mix.bind(util, {}),

	/**
	 * Iterate key-value pair in object or array.
	 * @param obj {Object|Array}
	 * @param iterator {Function}
	 * @param context {Object}
	 * @return {Object|Array}
	 */
	each = util.each = function (obj, iterator, context) {
		if (isArray(obj)) {
			return obj.forEach(iterator, context);
		} else {
			Object.keys(obj).forEach(function (key) {
				iterator.call(context || null, obj[key], key, obj);
			});
			return obj;
		}
	},

	/**
	 * Remove duplicated items from array.
	 * @param arr {Array}
	 * @return {Array}
	 */
	unique = util.unique = function (arr) {
		return arr.filter(function (value, index, arr) {
			return arr.indexOf(value) === index;
		});
	};

module.exports = util;
