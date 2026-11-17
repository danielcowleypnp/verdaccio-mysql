import * as mysql from "mysql";

export interface IMysqlQueries {
	readonly add_user?: string;
	readonly update_user?: string;
	readonly auth_user?: string;
}

export interface MysqlAuthConfig {
	connection: mysql.ConnectionConfig;
	queries?: IMysqlQueries;
}