/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import apm from 'elastic-apm-node';
import App from '../src/app';
import { Pacs002, Pacs008, Pain001, Pain013 } from '../src/classes/pain-pacs';
import { configuration } from '../src/config';
import { cache, databaseManager, init, runServer } from '../src/index';
import { TransactionRelationship } from '../src/interfaces/iTransactionRelationship';
import { handlePacs002, handlePacs008, handlePain001, handlePain013, rebuildCache } from '../src/logic.service';
import { cacheDatabaseClient } from '../src/services-container';
import { LoggerService } from '../src/logger.service';

let app: App;

jest.mock('elastic-apm-node');
const mockApm = apm as jest.Mocked<typeof apm>;

interface MockedSpan extends Omit<apm.Span, 'end'> {
  end: jest.Mock;
}

(mockApm.startSpan as jest.MockedFunction<typeof mockApm.startSpan>).mockReturnValue({
  end: jest.fn(),
} as MockedSpan);

beforeAll(async () => {
  app = await runServer();
  await init();
});

afterAll(() => {
  cache.close();
  cacheDatabaseClient.quit();
  databaseManager.quit();
  app.terminate();
});

describe('App Controller & Logic Service', () => {
  const getMockEmptyRequest = () => JSON.parse('{}');

  const getMockRequestPain001 = () =>
    JSON.parse(
      '{"TxTp":"pain.001.001.11","DataCache": {"cdtrId": "+42-966969344","dbtrId": "+36-432226947","cdtrAcctId": "+42-966969344","dbtrAcctId": "+36-432226947"},"CstmrCdtTrfInitn":{"GrpHdr":{"MsgId":"17fa-afea-48d6-b147-05c8463ea494","CreDtTm":"2023-02-03T07:03:17.438Z","NbOfTxs":1,"InitgPty":{"Nm":"April Blake Grant","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1968-02-01","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+36-432226947","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+36-432226947"}}},"PmtInf":{"PmtInfId":"23730c89dd57490a9a79f9b3747e3c08","PmtMtd":"TRA","ReqdAdvcTp":{"DbtAdvc":{"Cd":"ADWD","Prtry":"Advice with transaction details"}},"ReqdExctnDt":{"Dt":"2023-02-03","DtTm":"2023-02-03T07:03:17.438Z"},"Dbtr":{"Nm":"April Blake Grant","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1968-02-01","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+36-432226947","SchmeNm":{"Prtry":"typolog028"}}}},"CtctDtls":{"MobNb":"+36-432226947"}},"DbtrAcct":{"Id":{"Othr":{"Id":"+36-432226947","SchmeNm":{"Prtry":"MSISDN"}}},"Nm":"April Grant"},"DbtrAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"typolog028"}}},"CdtTrfTxInf":{"PmtId":{"EndToEndId":"8f37-9e6f-4c30-bb87-5e0e42f0f000"},"PmtTpInf":{"CtgyPurp":{"Prtry":"TRANSFER BLANK"}},"Amt":{"InstdAmt":{"Amt":{"Amt":31020.89,"Ccy":"USD"}},"EqvtAmt":{"Amt":{"Amt":31020.89,"Ccy":"USD"},"CcyOfTrf":"USD"}},"ChrgBr":"DEBT","CdtrAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp002"}}},"Cdtr":{"Nm":"Felicia Easton Quill","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1935-05-08","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+42-966969344","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+42-966969344"}},"CdtrAcct":{"Id":{"Othr":{"Id":"+42-966969344","SchmeNm":{"Prtry":"MSISDN"}}},"Nm":"Felicia Quill"},"Purp":{"Cd":"MP2P"},"RgltryRptg":{"Dtls":{"Tp":"BALANCE OF PAYMENTS","Cd":"100"}},"RmtInf":{"Ustrd":"Payment of USD 30713.75 from April to Felicia"},"SplmtryData":{"Envlp":{"Doc":{"Dbtr":{"FrstNm":"April","MddlNm":"Blake","LastNm":"Grant","MrchntClssfctnCd":"BLANK"},"Cdtr":{"FrstNm":"Felicia","MddlNm":"Easton","LastNm":"Quill","MrchntClssfctnCd":"BLANK"},"DbtrFinSvcsPrvdrFees":{"Ccy":"USD","Amt":307.14},"Xprtn":"2021-11-30T10:38:56.000Z"}}}}},"SplmtryData":{"Envlp":{"Doc":{"InitgPty":{"InitrTp":"CONSUMER","Glctn":{"Lat":"-3,1609","Long":"38,3588"}}}}}}}',
    );

  const getMockRequestPain013 = () =>
    JSON.parse(
      '{"TxTp":"pain.013.001.09","CdtrPmtActvtnReq":{"GrpHdr":{"MsgId":"53bf-5388-4aa3-ac23-6180ac1ce5ab","CreDtTm":"2023-02-01T12:47:23.470Z","NbOfTxs":1,"InitgPty":{"Nm":"Horatio Sam Ford","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1981-04-11","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+58-210165155","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+58-210165155"}}},"PmtInf":{"PmtInfId":"7a25e5694b8649d09702cc2162d07550","PmtMtd":"TRA","ReqdAdvcTp":{"DbtAdvc":{"Cd":"ADWD","Prtry":"Advice with transaction details"}},"ReqdExctnDt":{"DtTm":"2023-02-01T12:47:23.470Z"},"XpryDt":{"DtTm":"2023-02-01T12:47:23.470Z"},"Dbtr":{"Nm":"2023-02-01T12:47:23.470Z","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"2021-10-07","CityOfBirth":"Unknown","CtryOfBirth":"zz"},"Othr":{"Id":"ZZ","SchmeNm":{"Prtry":"+58-210165155"}}}},"CtctDtls":{"MobNb":"+58-210165155"}},"DbtrAcct":{"Id":{"Othr":{"Id":"+58-210165155","SchmeNm":{"Prtry":"+58-210165155"},"Nm":"PASSPORT"}}},"DbtrAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"Horatio Ford"}}},"CdtTrfTxInf":{"PmtId":{"EndToEndId":"02d5-dd5d-4995-a643-bd31c0a89e7a"},"PmtTpInf":{"CtgyPurp":{"Prtry":"TRANSFER"}},"Amt":{"InstdAmt":{"Amt":{"Amt":50431891779910900,"Ccy":"USD"}},"EqvtAmt":{"Amt":{"Amt":50431891779910900,"Ccy":"USD"},"CcyOfTrf":"USD"}},"ChrgBr":"DEBT","CdtrAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp002"}}},"Cdtr":{"Nm":"April Sam Adamson","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1923-04-26","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+04-830018596","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+04-830018596"}},"CdtrAcct":{"Id":{"Othr":{"Id":"+04-830018596","SchmeNm":{"Prtry":"dfsp002"}}},"Nm":"April Adamson"},"Purp":{"Cd":"MP2P"},"RgltryRptg":{"Dtls":{"Tp":"BALANCE OF PAYMENTS","Cd":"100"}},"RmtInf":{"Ustrd":"Payment of USD 49932566118723700.89 from Ivan to April"},"SplmtryData":{"Envlp":{"Doc":{"PyeeRcvAmt":{"Amt":{"Amt":4906747824834590,"Ccy":"USD"}},"PyeeFinSvcsPrvdrFee":{"Amt":{"Amt":49067478248345.9,"Ccy":"USD"}},"PyeeFinSvcsPrvdrComssn":{"Amt":{"Amt":0,"Ccy":"USD"}}}}}}},"SplmtryData":{"Envlp":{"Doc":{"InitgPty":{"Glctn":{"Lat":"-3.1675","Long":"39.059"}}}}}}}',
    );

  const getMockRequestPacs008 = () =>
    JSON.parse(
      '{"TxTp":"pacs.008.001.10","FIToFICstmrCdt":{"GrpHdr":{"MsgId":"cabb-32c3-4ecf-944e-654855c80c38","CreDtTm":"2023-02-03T07:17:52.216Z","NbOfTxs":1,"SttlmInf":{"SttlmMtd":"CLRG"}},"CdtTrfTxInf":{"PmtId":{"InstrId":"4ca819baa65d4a2c9e062f2055525046","EndToEndId":"701b-ae14-46fd-a2cf-88dda2875fdd"},"IntrBkSttlmAmt":{"Amt":{"Amt":31020.89,"Ccy":"USD"}},"InstdAmt":{"Amt":{"Amt":9000,"Ccy":"ZAR"}},"ChrgBr":"DEBT","ChrgsInf":{"Amt":{"Amt":307.14,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"typology003"}}}},"InitgPty":{"Nm":"April Blake Grant","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1968-02-01","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+01-710694778","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+01-710694778"}},"Dbtr":{"Nm":"April Blake Grant","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1968-02-01","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+01-710694778","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+01-710694778"}},"DbtrAcct":{"Id":{"Othr":{"Id":"+01-710694778","SchmeNm":{"Prtry":"MSISDN"}}},"Nm":"April Grant"},"DbtrAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"typology003"}}},"CdtrAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp002"}}},"Cdtr":{"Nm":"Felicia Easton Quill","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1935-05-08","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+07-197368463","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+07-197368463"}},"CdtrAcct":{"Id":{"Othr":{"Id":"+07-197368463","SchmeNm":{"Prtry":"MSISDN"}}},"Nm":"Felicia Quill"},"Purp":{"Cd":"MP2P"}},"RgltryRptg":{"Dtls":{"Tp":"BALANCE OF PAYMENTS","Cd":"100"}},"RmtInf":{"Ustrd":"Payment of USD 30713.75 from April to Felicia"},"SplmtryData":{"Envlp":{"Doc":{"Xprtn":"2023-02-03T07:17:52.216Z"}}}}}',
    );

  const getMockRequestPacs002 = () =>
    JSON.parse(
      '{"TxTp":"pacs.002.001.12","FIToFIPmtSts":{"GrpHdr":{"MsgId":"136a-dbb6-43d8-a565-86b8f322411e","CreDtTm":"2023-02-03T09:53:58.069Z"},"TxInfAndSts":{"OrgnlInstrId":"5d158d92f70142a6ac7ffba30ac6c2db","OrgnlEndToEndId":"701b-ae14-46fd-a2cf-88dda2875fdd","TxSts":"ACCC","ChrgsInf":[{"Amt":{"Amt":307.14,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"typolog028"}}}},{"Amt":{"Amt":153.57,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"typolog028"}}}},{"Amt":{"Amt":300.71,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp002"}}}}],"AccptncDtTm":"2023-02-03T09:53:58.069Z","InstgAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"typolog028"}}},"InstdAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp002"}}}}}}',
    );

  beforeEach(() => {
    jest.spyOn(cacheDatabaseClient, 'getPseudonyms').mockImplementation((hash: string) => {
      return new Promise((resolve, reject) => {
        resolve('');
      });
    });

    jest.spyOn(cacheDatabaseClient, 'addAccount').mockImplementation((hash: string) => {
      return new Promise((resolve, reject) => {
        resolve('');
      });
    });

    jest.spyOn(cacheDatabaseClient, 'addEntity').mockImplementation((entityId: string, CreDtTm: string) => {
      return new Promise((resolve, reject) => {
        resolve('');
      });
    });

    jest.spyOn(cacheDatabaseClient, 'addAccountHolder').mockImplementation((entityId: string, accountId: string, CreDtTm: string) => {
      return new Promise((resolve, reject) => {
        resolve('');
      });
    });

    jest.spyOn(cacheDatabaseClient, 'saveTransactionRelationship').mockImplementation((tR: TransactionRelationship) => {
      return new Promise((resolve, reject) => {
        resolve('');
      });
    });

    jest
      .spyOn(cacheDatabaseClient, 'saveTransactionHistory')
      .mockImplementation((transaction: any, transactionhistorycollection: string) => {
        return new Promise((resolve, reject) => {
          resolve('');
        });
      });

    jest.spyOn(cacheDatabaseClient, 'savePseudonym').mockImplementation((pseudonym: any) => {
      return new Promise((resolve, reject) => {
        resolve('');
      });
    });

    jest.spyOn(databaseManager, 'getTransactionPain001').mockImplementation((pseudonym: any) => {
      return new Promise((resolve, reject) => {
        resolve([[getMockRequestPain001() as Pain001]]);
      });
    });

    jest.spyOn(databaseManager, 'getJson').mockImplementation((key: any) => {
      return new Promise((resolve, reject) => {
        resolve(getMockRequestPain001().DataCache);
      });
    });

    jest.spyOn(databaseManager, 'setJson').mockImplementation((pseudonym: any) => {
      return new Promise((resolve, reject) => {
        resolve('OK');
      });
    });

    jest.spyOn(axios, 'post').mockImplementation((url: string, data?: any) => {
      return new Promise((resolve, reject) => {
        resolve({ status: 200 });
      });
    });
  });

  describe('handleExecute', () => {
    it('should handle Quote', async () => {
      const request = getMockRequestPain001() as Pain001;

      const result = await handlePain001(request);
      expect(result.transaction.CstmrCdtTrfInitn?.PmtInf?.CdtTrfTxInf?.CdtrAcct?.Id?.Othr?.SchmeNm?.Prtry).toEqual('MSISDN');
      expect(result.transaction.CstmrCdtTrfInitn?.PmtInf?.DbtrAcct?.Id?.Othr?.SchmeNm?.Prtry).toEqual('MSISDN');
      expect(result.DataCache.cdtrId).toEqual('+42-966969344');
      expect(result.DataCache.cdtrAcctId).toEqual('32b405ee32c746e7353aa4fb79357e166279cee9ec36f8fa29245de68003c42f');
      expect(result.DataCache.dbtrId).toEqual('+36-432226947');
      expect(result.DataCache.dbtrAcctId).toEqual('7647ffbee21a5ccc2821729f1b7c93a3f7998789b8ca31012c3490e79c8caf4b');
      expect(result.transaction.CstmrCdtTrfInitn?.PmtInf?.DbtrAcct?.Id?.Othr?.SchmeNm?.Prtry).toEqual('MSISDN');
    });

    it('should handle Quote, database error', async () => {
      const request = getMockRequestPain001() as Pain001;

      jest
        .spyOn(cacheDatabaseClient, 'saveTransactionHistory')
        .mockImplementation((transaction: any, transactionhistorycollection: string) => {
          return new Promise((resolve, reject) => {
            throw new Error('Deliberate Error');
          });
        });

      let error = '';
      try {
        const result = await handlePain001(request);
      } catch (err: any) {
        error = err?.message;
      }
      expect(error).toEqual('Deliberate Error');
    });
  });

  describe('handleQuoteReply', () => {
    it('should handle Quote Reply', async () => {
      const request = getMockRequestPain013() as Pain013;

      const result = await handlePain013(request);
      expect(result.transaction.CdtrPmtActvtnReq?.PmtInf?.CdtTrfTxInf?.CdtrAcct?.Id?.Othr.SchmeNm?.Prtry).toEqual('dfsp002');
      expect(result.DataCache!.cdtrId).toEqual('+42-966969344');
      expect(result.DataCache!.cdtrAcctId).toEqual('32b405ee32c746e7353aa4fb79357e166279cee9ec36f8fa29245de68003c42f');
      expect(result.DataCache!.dbtrId).toEqual('+36-432226947');
      expect(result.DataCache!.dbtrAcctId).toEqual('7647ffbee21a5ccc2821729f1b7c93a3f7998789b8ca31012c3490e79c8caf4b');
    });

    it('should handle Quote Reply, database error', async () => {
      const request = getMockRequestPain013() as Pain013;

      jest
        .spyOn(cacheDatabaseClient, 'saveTransactionHistory')
        .mockImplementation((transaction: any, transactionhistorycollection: string) => {
          return new Promise((resolve, reject) => {
            throw new Error('Deliberate Error');
          });
        });

      let error = '';
      try {
        const result = await handlePain013(request);
      } catch (err: any) {
        error = err?.message;
      }
      expect(error).toEqual('Deliberate Error');
    });
  });

  describe('handleTransfer', () => {
    it('should handle Transfer', async () => {
      const request = getMockRequestPacs008() as Pacs008;

      const result = await handlePacs008(request);
      expect(result.transaction.FIToFICstmrCdt?.CdtTrfTxInf?.DbtrAcct?.Id?.Othr?.SchmeNm?.Prtry).toEqual('MSISDN');
      expect(result.transaction.FIToFICstmrCdt?.CdtTrfTxInf?.Cdtr?.Id?.PrvtId?.Othr?.SchmeNm?.Prtry).toEqual('MSISDN');
      expect(result.DataCache!.cdtrId).toEqual('+42-966969344');
      expect(result.DataCache!.cdtrAcctId).toEqual('32b405ee32c746e7353aa4fb79357e166279cee9ec36f8fa29245de68003c42f');
      expect(result.DataCache!.dbtrId).toEqual('+36-432226947');
      expect(result.DataCache!.dbtrAcctId).toEqual('7647ffbee21a5ccc2821729f1b7c93a3f7998789b8ca31012c3490e79c8caf4b');
    });

    it('should handle Transfer, database error', async () => {
      jest
        .spyOn(cacheDatabaseClient, 'saveTransactionHistory')
        .mockImplementation((transaction: Pain001 | Pain013 | Pacs008 | Pacs002, transactionhistorycollection: string) => {
          return new Promise((resolve, reject) => {
            throw new Error('Deliberate Error');
          });
        });
      const request = getMockRequestPacs008() as Pacs008;

      let error = '';
      try {
        const result = await handlePacs008(request);
      } catch (err: any) {
        error = err?.message;
      }
      expect(error).toEqual('Deliberate Error');
    });
  });

  describe('handleTransferResponse', () => {
    it('should handle Transfer Response', async () => {
      jest.spyOn(cacheDatabaseClient, 'getTransactionHistoryPacs008').mockImplementation((EndToEndId: string) => {
        return new Promise((resolve, reject) => {
          resolve(
            JSON.parse(
              '[[{"TxTp":"pacs.008.001.10","FIToFICstmrCdt":{"GrpHdr":{"MsgId":"cabb-32c3-4ecf-944e-654855c80c38","CreDtTm":"2023-02-03T07:17:52.216Z","NbOfTxs":1,"SttlmInf":{"SttlmMtd":"CLRG"}},"CdtTrfTxInf":{"PmtId":{"InstrId":"4ca819baa65d4a2c9e062f2055525046","EndToEndId":"701b-ae14-46fd-a2cf-88dda2875fdd"},"IntrBkSttlmAmt":{"Amt":{"Amt":31020.89,"Ccy":"USD"}},"InstdAmt":{"Amt":{"Amt":9000,"Ccy":"ZAR"}},"ChrgBr":"DEBT","ChrgsInf":{"Amt":{"Amt":307.14,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"typology003"}}}},"InitgPty":{"Nm":"April Blake Grant","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1968-02-01","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+01-710694778","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+01-710694778"}},"Dbtr":{"Nm":"April Blake Grant","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1968-02-01","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+01-710694778","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+01-710694778"}},"DbtrAcct":{"Id":{"Othr":{"Id":"+01-710694778","SchmeNm":{"Prtry":"MSISDN"}}},"Nm":"April Grant"},"DbtrAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"typology003"}}},"CdtrAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp002"}}},"Cdtr":{"Nm":"Felicia Easton Quill","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1935-05-08","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+07-197368463","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+07-197368463"}},"CdtrAcct":{"Id":{"Othr":{"Id":"+07-197368463","SchmeNm":{"Prtry":"MSISDN"}}},"Nm":"Felicia Quill"},"Purp":{"Cd":"MP2P"}},"RgltryRptg":{"Dtls":{"Tp":"BALANCE OF PAYMENTS","Cd":"100"}},"RmtInf":{"Ustrd":"Payment of USD 30713.75 from April to Felicia"},"SplmtryData":{"Envlp":{"Doc":{"Xprtn":"2023-02-03T07:17:52.216Z"}}}}}]]',
            ),
          );
        });
      });

      const request = getMockRequestPacs002() as Pacs002;

      const result = await handlePacs002(request);
      expect(result.transaction).toEqual(request);
      expect(result.DataCache!.cdtrId).toEqual('+42-966969344');
      expect(result.DataCache!.cdtrAcctId).toEqual('32b405ee32c746e7353aa4fb79357e166279cee9ec36f8fa29245de68003c42f');
      expect(result.DataCache!.dbtrId).toEqual('+36-432226947');
      expect(result.DataCache!.dbtrAcctId).toEqual('7647ffbee21a5ccc2821729f1b7c93a3f7998789b8ca31012c3490e79c8caf4b');
    });

    it('should handle Transfer Response, database error', async () => {
      jest.spyOn(cacheDatabaseClient, 'getTransactionHistoryPacs008').mockImplementation((EndToEndId: string) => {
        return new Promise((resolve, reject) => {
          throw new Error('Deliberate Error');
        });
      });
      const request = getMockRequestPacs002() as Pacs002;

      let error = '';
      try {
        const result = await handlePacs002(request);
      } catch (err: any) {
        error = err?.message;
      }
      expect(error).toEqual('Deliberate Error');
    });
  });

  describe('rebuildCache', () => {
    it('should handle getTransactionPain001, empty result', async () => {
      const loggerErrorSpy = jest.spyOn(LoggerService, 'error')
      jest.spyOn(databaseManager, 'getTransactionPain001').mockImplementation((EndToEndId: string) => {
        return new Promise((resolve) => {
          resolve([[]])
        });
      });
      const result = await rebuildCache('test-EndToEndId');
      expect(loggerErrorSpy).toBeCalledTimes(1);
      expect(loggerErrorSpy).toBeCalledWith('Could not find pain001 transaction to rebuild dataCache with');
      expect(result).toEqual(undefined);
    });
  })

  describe('Send Transaction to CRSP', () => {
    it('fail gracefully', async () => {
      jest.spyOn(axios, 'post').mockImplementation((url: string, data?: any) => {
        return new Promise((resolve, reject) => {
          resolve({ status: 500 });
        });
      });

      const request = getMockRequestPacs008() as Pacs008;
      await handlePacs008(request);

      expect(axios.post).toBeCalledTimes(1);
    });

    it('handle no endpoint exception', async () => {
      configuration.crspEndpoint = '';
      jest.spyOn(axios, 'post').mockRejectedValue((url: string, data?: any) => {
        return new Promise((resolve, reject) => {
          resolve(new Error('test'));
        });
      });

      const request = getMockRequestPacs008() as Pacs008;
      await handlePacs008(request);

      expect(axios.post).toBeCalledTimes(1);
    });

    it('handle generic exception', async () => {
      configuration.crspEndpoint = 'crsp';
      jest.spyOn(axios, 'post').mockRejectedValue((url: string, data?: any) => {
        return new Promise((resolve, reject) => {
          resolve(new Error('test'));
        });
      });

      const request = getMockRequestPacs008() as Pacs008;
      await handlePacs008(request);

      expect(axios.post).toBeCalledTimes(1);
    });
  });
});
