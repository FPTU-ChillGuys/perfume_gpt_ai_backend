import { Injectable } from '@nestjs/common';
import { PrismaClient } from 'generated/prisma/client';
import { PrismaMssql } from '@prisma/adapter-mssql';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {

    const adapter = new PrismaMssql({
      server: process.env.SQL_SERVER_DATABASE_SERVER ?? 'localhost',      
      port: Number(process.env.SQL_SERVER_DATABASE_PORT),  
      user: process.env.SQL_SERVER_DATABASE_USER,          
      password: process.env.SQL_SERVER_DATABASE_PASSWORD,  
      database: process.env.SQL_SERVER_DATABASE_NAME,      
      options: {
        encrypt: false,
        trustServerCertificate: true,
      }
    });

    super({ adapter });
  }
}