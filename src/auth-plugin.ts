import debugCore from 'debug';

import {pluginUtils} from '@verdaccio/core';
import {Config, Logger} from '@verdaccio/types';

import {MysqlAuthConfig} from '../types';
import {MysqlQueries} from "./sql-queries";
import * as mysql from 'mysql';

// Initialize debug logging
// Replace 'custom-auth-plugin' with your plugin name
// This code is meant to help during development and debugging
const debug = debugCore('verdaccio:plugin:mysql');

export default class MysqlAuth extends pluginUtils.Plugin<MysqlAuthConfig> implements pluginUtils.Auth<MysqlAuthConfig> {
	private _logger: Logger;
	private readonly _config: mysql.ConnectionConfig;
	private readonly _app_config: Config;
	private connection: mysql.Connection;
	
	private queries: MysqlQueries;
	private authQueryEmptyWarned: boolean;
	private addQueryEmptyWarned: boolean;
	private passwordQueryEmptyWarned: boolean;
	
	constructor(config: MysqlAuthConfig, appOptions: pluginUtils.PluginOptions) {
		super(config, appOptions);
		this._config = config?.connection ?? {};
		this._logger = appOptions.logger;
		this._app_config = appOptions.config;
		this.queries = new MysqlQueries(config?.queries);
		
		this.authQueryEmptyWarned = false;
		this.addQueryEmptyWarned = false;
		this.passwordQueryEmptyWarned = false;
		this.connection = mysql.createConnection(this._config);
		
		this.test();
		debug('AuthCustomPlugin config (debug): %o', this._config);
		debug('App Config: %o', this._app_config);
	}
	
	/**
	 * Authenticate an user.
	 * @param user user to log
	 * @param password provided password
	 * @param cb callback function
	 */
	public authenticate(user: string, password: string, cb: pluginUtils.AuthCallback): void {
		if (this.queries.auth_user.length == 0 && !this.authQueryEmptyWarned) {
			this._logger.warn('MySQL - Can\'t authenticate: authenticate query is empty');
			this.authQueryEmptyWarned = true;
			return cb(null, false);
		}
		
		debug('Authenticating user: %o', user);
		debug('Password: %o', password);
		
		this.runQuery(this.queries.auth_user, [user, password], (error, result) => {
			if (error) {
				return cb(null, false);
			}
			
			if (!Array.isArray(result)) {
				this._logger.error({}, 'MySQL - Result is not an rowset');
				return cb(null, false);
			}
			
			if (result[0] === null) {
				this._logger.error({}, 'MySQL - The query returned an invalid result');
				return cb(null, false);
			}
			
			if (result.length === 0) {
				// Usual case where everything is valid but we got a bad password.
				return cb(null, false);
			}
			
			if (result.length > 1) {
				this._logger.error({"rows": result.length}, "MySQL - The query returned @{rows} rows. Only one row must be returned.");
				return cb(null, false);
			}
			
			let groups: string = "";
			if (result[0].usergroups === undefined) {
				this._logger.warn({}, "MySQL - The query didn't contain a `usergroups` column. Group feature will likely not be functional.");
			} else if (result[0].usergroups !== null) {
				groups = result[0].usergroups;
			}
			
			return cb(null, groups.split(','));
		});
	}
	
	adduser(user: string, password: string, cb: pluginUtils.AuthUserCallback) {
		if (this.queries.add_user.length == 0 && !this.addQueryEmptyWarned) {
			this._logger.warn({}, 'MySQL - Can\'t add user: add_user query is empty');
			this.addQueryEmptyWarned = true;
			return cb(null, false);
		}
		
		this.runQuery(this.queries.add_user, [user, password], (error, result) => {
			if (error) {
				this._logger.error({error}, "MySQL - Error: @{error.message}");
				return cb(null, false);
			}
			
			return cb(null, true);
		});
	}
	
	changePassword(user: string, password: string, newPassword: string, cb: pluginUtils.AuthChangePasswordCallback) {
		if (this.queries.update_user.length == 0 && !this.passwordQueryEmptyWarned) {
			this._logger.warn({}, 'MySQL - Can\'t change password: update_user query is empty');
			this.passwordQueryEmptyWarned = true;
			return cb(null, false);
		}
		
		this.runQuery(this.queries.update_user, [newPassword, user, password], (error, result) => {
			if (error) {
				this._logger.error({error}, "MySQL - Error: @{error.message}");
				cb(null, false);
			}
			
			cb(null, true);
		});
	}
	
	private async test(): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			
			this.runQuery('SELECT 1', [], (err, res) => {
				if (err) {
					this._logger.error({}, 'MySQL - Test connection did not work');
					this._logger.error({err}, 'MySQL - Error: @{err.message}');
					reject();
				}
				
				resolve(true);
				return;
			});
		});
	}
	
	private runQuery(query: string, parameters: string[], callback: mysql.queryCallback): void {
		if(!this.connection) {
			this.connection = mysql.createConnection(this._config);
		}
		
		this._logger.debug({query, parameters}, 'MySQL - Running @{query} with @{parameters}');
		this.connection.query(query, parameters, (error, result) => {
			if (error) {
				this._logger.error({error}, 'MySQL - Error: @{error.message}');
			}
			
			return callback(error, result);
		});
	}
}
