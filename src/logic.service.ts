import apm from './apm';
import { cacheDatabaseClient, databaseManager, loggerService, server } from '.';
import { type Pacs002, type Pacs008, type Pain001, type Pain013, type DataCache } from '@frmscoe/frms-coe-lib/lib/interfaces';
import { configuration } from './config';
import { type TransactionRelationship } from './interfaces/iTransactionRelationship';
import { createMessageBuffer } from '@frmscoe/frms-coe-lib/lib/helpers/protobuf';

const calculateDuration = (startTime: bigint): number => {
  const endTime = process.hrtime.bigint();
  return Number(endTime - startTime);
};

export const handlePain001 = async (transaction: Pain001): Promise<void> => {
  loggerService.log('Start - Handle transaction data');
  const span = apm.startSpan('transaction.pain001');

  const startTime = process.hrtime.bigint();

  const Amt = transaction.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf.Amt.InstdAmt.Amt.Amt;
  const Ccy = transaction.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf.Amt.InstdAmt.Amt.Ccy;
  const creditorAcctId = transaction.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf.CdtrAcct.Id.Othr.Id;
  const creditorId = transaction.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf.Cdtr.Id.PrvtId.Othr.Id;
  const CreDtTm = transaction.CstmrCdtTrfInitn.GrpHdr.CreDtTm;
  const debtorAcctId = transaction.CstmrCdtTrfInitn.PmtInf.DbtrAcct.Id.Othr.Id;
  const debtorId = transaction.CstmrCdtTrfInitn.PmtInf.Dbtr.Id.PrvtId.Othr.Id;
  const EndToEndId = transaction.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf.PmtId.EndToEndId;
  const lat = transaction.CstmrCdtTrfInitn.SplmtryData.Envlp.Doc.InitgPty.Glctn.Lat;
  const long = transaction.CstmrCdtTrfInitn.SplmtryData.Envlp.Doc.InitgPty.Glctn.Long;
  const MsgId = transaction.CstmrCdtTrfInitn.GrpHdr.MsgId;
  const PmtInfId = transaction.CstmrCdtTrfInitn.PmtInf.PmtInfId;
  const TxTp = transaction.TxTp;

  const transactionRelationship: TransactionRelationship = {
    from: `accounts/${debtorAcctId}`,
    to: `accounts/${creditorAcctId}`,
    Amt,
    Ccy,
    CreDtTm,
    EndToEndId,
    lat,
    long,
    MsgId,
    PmtInfId,
    TxTp,
  };

  const dataCache: DataCache = {
    cdtrId: creditorId,
    dbtrId: debtorId,
    cdtrAcctId: creditorAcctId,
    dbtrAcctId: debtorAcctId,
  };

  const spanInsert = apm.startSpan('db.insert.pain001');
  try {
    const cacheBuffer = createMessageBuffer({ DataCache: { ...dataCache } });
    if (!cacheBuffer) {
      throw new Error('[pain001] dataCache could not be serialised to buffer');
    }
    await Promise.all([
      cacheDatabaseClient.saveTransactionHistory(
        transaction,
        configuration.db.transactionhistory_pain001_collection,
        `pain001_${EndToEndId}`,
      ),
      cacheDatabaseClient.addAccount(debtorAcctId),
      cacheDatabaseClient.addAccount(creditorAcctId),
      cacheDatabaseClient.addEntity(creditorId, CreDtTm),
      cacheDatabaseClient.addEntity(debtorId, CreDtTm),
      databaseManager.set(EndToEndId, cacheBuffer, 150),
    ]);

    await Promise.all([
      cacheDatabaseClient.saveTransactionRelationship(transactionRelationship),
      cacheDatabaseClient.addAccountHolder(creditorId, creditorAcctId, CreDtTm),
      cacheDatabaseClient.addAccountHolder(debtorId, debtorAcctId, CreDtTm),
    ]);
  } catch (err) {
    loggerService.log(JSON.stringify(err));
    spanInsert?.end();
    span?.end();
    throw err;
  }
  spanInsert?.end();

  // Notify CRSP
  server.handleResponse({
    transaction,
    DataCache: dataCache,
    metaData: {
      prcgTmDP: calculateDuration(startTime),
      traceParent: apm.getCurrentTraceparent(),
    },
  });
  loggerService.log('Transaction send to CRSP service');

  span?.end();
  loggerService.log('END - Handle transaction data');
};

export const handlePain013 = async (transaction: Pain013): Promise<void> => {
  loggerService.log('Start - Handle transaction data');
  const span = apm.startSpan('transaction.pain013');
  const startTime = process.hrtime.bigint();

  const Amt = transaction.CdtrPmtActvtnReq.PmtInf.CdtTrfTxInf.Amt.InstdAmt.Amt.Amt;
  const Ccy = transaction.CdtrPmtActvtnReq.PmtInf.CdtTrfTxInf.Amt.InstdAmt.Amt.Ccy;
  const CreDtTm = transaction.CdtrPmtActvtnReq.GrpHdr.CreDtTm;
  const EndToEndId = transaction.CdtrPmtActvtnReq.PmtInf.CdtTrfTxInf.PmtId.EndToEndId;
  const MsgId = transaction.CdtrPmtActvtnReq.GrpHdr.MsgId;
  const PmtInfId = transaction.CdtrPmtActvtnReq.PmtInf.PmtInfId;
  const TxTp = transaction.TxTp;

  const creditorAcctId = transaction.CdtrPmtActvtnReq.PmtInf.CdtTrfTxInf.CdtrAcct.Id.Othr.Id;
  const debtorAcctId = transaction.CdtrPmtActvtnReq.PmtInf.DbtrAcct.Id.Othr.Id;

  const transactionRelationship: TransactionRelationship = {
    from: `accounts/${creditorAcctId}`,
    to: `accounts/${debtorAcctId}`,
    Amt,
    Ccy,
    CreDtTm,
    EndToEndId,
    MsgId,
    PmtInfId,
    TxTp,
  };

  let dataCache;
  const spanDataCache = apm.startSpan('req.get.dataCache.pain013');
  try {
    const cache = (await databaseManager.getBuffer(EndToEndId)).DataCache;
    dataCache = cache as DataCache;
  } catch (ex) {
    loggerService.log(`Could not retrieve data cache for : ${EndToEndId} from redis. Proceeding with Arango Call.`);
    dataCache = await rebuildCachePain001(EndToEndId);
  } finally {
    spanDataCache?.end();
  }

  transaction._key = MsgId;

  const spanInsert = apm.startSpan('db.insert.pain013');
  try {
    await Promise.all([
      cacheDatabaseClient.saveTransactionHistory(
        transaction,
        configuration.db.transactionhistory_pain013_collection,
        `pain013_${EndToEndId}`,
      ),
      cacheDatabaseClient.addAccount(debtorAcctId),
      cacheDatabaseClient.addAccount(creditorAcctId),
    ]);

    await cacheDatabaseClient.saveTransactionRelationship(transactionRelationship);
  } catch (err) {
    loggerService.log(JSON.stringify(err));
    spanInsert?.end();
    span?.end();
    throw err;
  }

  spanInsert?.end();

  // Notify CRSP
  server.handleResponse({
    transaction,
    DataCache: dataCache,
    metaData: {
      prcgTmDP: calculateDuration(startTime),
      traceParent: apm.getCurrentTraceparent(),
    },
  });
  loggerService.log('Transaction send to CRSP service');

  span?.end();
  loggerService.log('END - Handle transaction data');
};

export const handlePacs008 = async (transaction: Pacs008): Promise<void> => {
  loggerService.log('Start - Handle transaction data');
  const span = apm.startSpan('transaction.pacs008');
  const startTime = process.hrtime.bigint();

  const Amt = transaction.FIToFICstmrCdt.CdtTrfTxInf.InstdAmt.Amt.Amt;
  const Ccy = transaction.FIToFICstmrCdt.CdtTrfTxInf.InstdAmt.Amt.Ccy;
  const CreDtTm = transaction.FIToFICstmrCdt.GrpHdr.CreDtTm;
  const EndToEndId = transaction.FIToFICstmrCdt.CdtTrfTxInf.PmtId.EndToEndId;
  const MsgId = transaction.FIToFICstmrCdt.GrpHdr.MsgId;
  const PmtInfId = transaction.FIToFICstmrCdt.CdtTrfTxInf.PmtId.InstrId;
  const TxTp = transaction.TxTp;
  const debtorId = transaction.FIToFICstmrCdt.CdtTrfTxInf.Dbtr.Id.PrvtId.Othr.Id;
  const creditorId = transaction.FIToFICstmrCdt.CdtTrfTxInf.Cdtr.Id.PrvtId.Othr.Id;

  const debtorAcctId = transaction.FIToFICstmrCdt.CdtTrfTxInf.DbtrAcct.Id.Othr.Id;
  const creditorAcctId = transaction.FIToFICstmrCdt.CdtTrfTxInf.CdtrAcct.Id.Othr.Id;

  const transactionRelationship: TransactionRelationship = {
    from: `accounts/${debtorAcctId}`,
    to: `accounts/${creditorAcctId}`,
    Amt,
    Ccy,
    CreDtTm,
    EndToEndId,
    MsgId,
    PmtInfId,
    TxTp,
  };

  const accountInserts = [cacheDatabaseClient.addAccount(debtorAcctId), cacheDatabaseClient.addAccount(creditorAcctId)];
  let dataCache: DataCache | undefined;
  if (!configuration.quoting) {
    dataCache = {
      cdtrId: creditorId,
      dbtrId: debtorId,
      cdtrAcctId: creditorAcctId,
      dbtrAcctId: debtorAcctId,
    };

    const cacheBuffer = createMessageBuffer({ DataCache: { ...dataCache } });

    accountInserts.push(cacheDatabaseClient.addEntity(creditorId, CreDtTm));
    accountInserts.push(cacheDatabaseClient.addEntity(debtorId, CreDtTm));
    if (cacheBuffer) {
      accountInserts.push(databaseManager.set(EndToEndId, cacheBuffer, 150));
    } else {
      // this is fatal
      throw new Error('[pacs008] data cache could not be serialised');
    }
    await Promise.all(accountInserts);

    await Promise.all([
      cacheDatabaseClient.addAccountHolder(creditorId, creditorAcctId, CreDtTm),
      cacheDatabaseClient.addAccountHolder(debtorId, debtorAcctId, CreDtTm),
    ]);
  } else {
    await Promise.all(accountInserts);
  }
  cacheDatabaseClient.saveTransactionRelationship(transactionRelationship);

  const spanDataCache = apm.startSpan('req.get.dataCache.pacs008');
  try {
    const dataCacheJSON = (await databaseManager.getBuffer(EndToEndId)).DataCache;
    dataCache = dataCacheJSON as DataCache;
  } catch (ex) {
    loggerService.log(`Could not retrieve data cache for : ${EndToEndId} from redis. Proceeding with Arango Call.`);
    dataCache = !configuration.quoting ? await rebuildCache(EndToEndId) : await rebuildCachePain001(EndToEndId);
  } finally {
    spanDataCache?.end();
  }

  cacheDatabaseClient.saveTransactionRelationship(transactionRelationship);
  const spanInsert = apm.startSpan('db.insert.pacs008');
  try {
    await Promise.all([
      cacheDatabaseClient.saveTransactionHistory(
        transaction,
        configuration.db.transactionhistory_pacs008_collection,
        `pacs008_${EndToEndId}`,
      ),
    ]);
  } catch (err) {
    loggerService.log(JSON.stringify(err));
    spanInsert?.end();
    span?.end();
    throw err;
  } finally {
    spanInsert?.end();
  }

  // Notify CRSP
  server.handleResponse({
    transaction,
    DataCache: dataCache,
    metaData: {
      prcgTmDP: calculateDuration(startTime),
      traceParent: apm.getCurrentTraceparent(),
    },
  });
  loggerService.log('Transaction send to CRSP service');
  span?.end();
};

export const handlePacs002 = async (transaction: Pacs002): Promise<void> => {
  loggerService.log('Start - Handle transaction data');
  const span = apm.startSpan('transactions.pacs002');
  const startTime = process.hrtime.bigint();

  const CreDtTm = transaction.FIToFIPmtSts.GrpHdr.CreDtTm;
  const EndToEndId = transaction.FIToFIPmtSts.TxInfAndSts.OrgnlEndToEndId;
  const MsgId = transaction.FIToFIPmtSts.GrpHdr.MsgId;
  const PmtInfId = transaction.FIToFIPmtSts.TxInfAndSts.OrgnlInstrId;
  const TxSts = transaction.FIToFIPmtSts.TxInfAndSts.TxSts;
  const TxTp = transaction.TxTp;

  const transactionRelationship: TransactionRelationship = {
    from: '',
    to: '',
    CreDtTm,
    EndToEndId,
    MsgId,
    PmtInfId,
    TxTp,
    TxSts,
  };

  let dataCache;
  const spanDataCache = apm.startSpan('req.get.dataCache.pacs002');
  try {
    const dataCacheJSON = (await databaseManager.getBuffer(EndToEndId)).DataCache;
    dataCache = dataCacheJSON as DataCache;
  } catch (ex) {
    loggerService.log(`Could not retrieve data cache for : ${EndToEndId} from redis. Proceeding with Arango Call.`);
    dataCache = !configuration.quoting ? await rebuildCache(EndToEndId) : await rebuildCachePain001(EndToEndId);
  } finally {
    spanDataCache?.end();
  }

  transaction._key = MsgId;

  const spanInsert = apm.startSpan('db.insert.pacs002');
  try {
    await cacheDatabaseClient.saveTransactionHistory(
      transaction,
      configuration.db.transactionhistory_pacs002_collection,
      `pacs002_${EndToEndId}`,
    );

    const result = (await cacheDatabaseClient.getTransactionHistoryPacs008(EndToEndId)) as [Pacs008[]];

    const debtorAcctId = result[0][0].FIToFICstmrCdt.CdtTrfTxInf.DbtrAcct.Id.Othr.Id;
    const creditorAcctId = result[0][0].FIToFICstmrCdt.CdtTrfTxInf.CdtrAcct.Id.Othr.Id;

    transactionRelationship.to = `accounts/${debtorAcctId}`;
    transactionRelationship.from = `accounts/${creditorAcctId}`;

    await cacheDatabaseClient.saveTransactionRelationship(transactionRelationship);
  } catch (err) {
    spanInsert?.end();
    loggerService.log(JSON.stringify(err));
    span?.end();
    throw err;
  } finally {
    spanInsert?.end();
  }

  // Notify CRSP
  server.handleResponse({
    transaction,
    DataCache: dataCache,
    metaData: {
      prcgTmDP: calculateDuration(startTime),
      traceParent: apm.getCurrentTraceparent(),
    },
  });
  loggerService.log('Transaction send to CRSP service');

  span?.end();
  loggerService.log('END - Handle transaction data');
};

/**
 * Rebuilds the DataCache object using the given endToEndId to fetch a stored Pacs008 message
 *
 * @param {string} endToEndId
 * @return {*}  {(Promise<DataCache | undefined>)}
 */
export const rebuildCache = async (endToEndId: string): Promise<DataCache | undefined> => {
  const span = apm.startSpan('db.cache.rebuild');
  const currentPacs008 = (await databaseManager.getTransactionPacs008(endToEndId)) as [Pacs008[]];
  if (!currentPacs008 || !currentPacs008[0] || !currentPacs008[0][0]) {
    loggerService.error('Could not find pacs008 transaction to rebuild dataCache with');
    span?.end();
    return undefined;
  }
  const dataCache: DataCache = {
    cdtrId: currentPacs008[0][0].FIToFICstmrCdt.CdtTrfTxInf.Cdtr.Id.PrvtId.Othr.Id,
    dbtrId: currentPacs008[0][0].FIToFICstmrCdt.CdtTrfTxInf.Dbtr.Id.PrvtId.Othr.Id,
    cdtrAcctId: currentPacs008[0][0].FIToFICstmrCdt.CdtTrfTxInf.CdtrAcct.Id.Othr.Id,
    dbtrAcctId: currentPacs008[0][0].FIToFICstmrCdt.CdtTrfTxInf.DbtrAcct.Id.Othr.Id,
  };

  const buffer = createMessageBuffer({ DataCache: { ...dataCache } });

  if (buffer) {
    await databaseManager.set(endToEndId, buffer, configuration.cacheTTL);
  } else {
    loggerService.error('[pacs008] could not rebuild redis cache');
  }

  span?.end();
  return dataCache;
};

export const rebuildCachePain001 = async (endToEndId: string): Promise<DataCache | undefined> => {
  const span = apm.startSpan('db.cache.rebuild');
  const currentPain001 = (await databaseManager.getTransactionPain001(endToEndId)) as [Pain001[]];
  if (!currentPain001 || !currentPain001[0] || !currentPain001[0][0]) {
    loggerService.error('Could not find pacs008 transaction to rebuild dataCache with');
    span?.end();
    return undefined;
  }
  const dataCache: DataCache = {
    cdtrId: currentPain001[0][0].CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf.Cdtr.Id.PrvtId.Othr.Id,
    dbtrId: currentPain001[0][0].CstmrCdtTrfInitn.PmtInf.Dbtr.Id.PrvtId.Othr.Id,
    cdtrAcctId: currentPain001[0][0].CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf.CdtrAcct.Id.Othr.Id,
    dbtrAcctId: currentPain001[0][0].CstmrCdtTrfInitn.PmtInf.DbtrAcct.Id.Othr.Id,
  };

  const buffer = createMessageBuffer({ DataCache: { ...dataCache } });

  if (buffer) {
    await databaseManager.set(endToEndId, buffer, configuration.cacheTTL);
  } else {
    loggerService.error('[pain001] could not rebuild redis cache');
  }

  span?.end();
  return dataCache;
};
