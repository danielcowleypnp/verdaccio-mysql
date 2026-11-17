import {IMysqlQueries} from "../types";

export class MysqlQueries implements IMysqlQueries {
	
	constructor(private custom?: IMysqlQueries) {
	}
	
	public get add_user(): string {
		return this.custom?.add_user ?? '';
	}
	
	public get update_user(): string {
		return this.custom?.update_user ?? '';
	}
	
	public get auth_user(): string {
		return this.custom?.auth_user ?? '';
	}
}
