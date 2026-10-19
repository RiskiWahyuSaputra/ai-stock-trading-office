/**
 * Builds src/server/providers/symbol-directory.json — the autocomplete
 * directory for the Yahoo provider. Candidate tickers are listed below; every
 * one is verified against Yahoo Finance and its name/sector are taken from
 * Yahoo. Tickers Yahoo does not recognise are dropped.
 *
 *   npm run symbols:update
 */
import { writeFileSync } from "node:fs";
import YahooFinance from "yahoo-finance2";

const IDX = `BBCA BBRI BMRI BBNI BRIS BBTN ARTO BNGA NISP PNBN MEGA BDMN BJBR BJTM BBYB BBHI AGRO BTPS
TLKM ISAT EXCL TOWR TBIG MTEL ASII UNTR AUTO GJTL SMSM ICBP INDF UNVR MYOR KLBF SIDO CPIN JPFA HMSP GGRM
CMRY ULTJ GOOD ROTI HOKI CLEO AMRT MIDI ACES MAPI MAPA ERAA LPPF RALS ADRO AADI ADMR PTBA ITMG HRUM INDY
BUMI DOID MEDC PGAS AKRA ELSA ENRG RAJA ANTM INCO MDKA TINS NCKL MBMA AMMN BRMS PSAB DEWA SMGR INTP SMBR
WIKA PTPP ADHI WSKT WTON WSBP JSMR CTRA BSDE PWON SMRA ASRI LPKR DMAS BREN BRPT TPIA CUAN PGEO ESSA GOTO
BUKA EMTK SCMA MNCN DNET MSIN MTDL SRTG INKP TKIM HEAL MIKA SILO PRDA MPMX TAPG AALI LSIP SSMS DSNG BWPT
KAEF INAF PYFA TSPC MARK SSIA BIRD ASSA TMAS SMDR GEMS KKGI BSSR TOBA ARCI MCOL ABMM MYOH RATU AVIA CDIA
JARR NICL DSSA SMAR FILM MLPT`.split(/\s+/);

const US = `AAPL MSFT NVDA AMZN GOOGL META TSLA BRK-B AVGO JPM LLY V MA UNH XOM JNJ WMT PG HD COST ORCL ABBV BAC
KO PEP MRK CVX NFLX ADBE CRM AMD INTC CSCO QCOM TXN IBM MU AMAT PLTR UBER ABNB SHOP PYPL DIS NKE MCD SBUX
BA CAT GE GM F T VZ TMUS PFE WFC C GS MS AXP SCHW BLK SPGI COIN HOOD SOFI RIVN LCID SNOW CRWD PANW NOW
INTU ARM SMCI TSM ASML BABA PDD NIO SE GRAB TLK`.split(/\s+/);

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

async function verify(codes, market) {
  const out = [];
  for (const code of [...new Set(codes)]) {
    const ySym = market === "IDX" ? `${code}.JK` : code;
    try {
      const q = await yf.quote(ySym);
      if (!q || q.quoteType !== "EQUITY" || !q.regularMarketPrice) throw new Error("not an active equity");
      let sector = "Equity";
      try {
        sector = (await yf.quoteSummary(ySym, { modules: ["assetProfile"] })).assetProfile?.sector ?? sector;
      } catch {}
      out.push({
        symbol: market === "IDX" ? code : code.replace(/-/g, "."),
        name: q.longName ?? q.shortName ?? code,
        market,
        sector,
        currency: market === "IDX" ? "IDR" : "USD",
      });
      process.stdout.write(".");
    } catch (e) {
      console.warn(`\nskip ${ySym}: ${e.message?.slice(0, 80)}`);
    }
  }
  return out;
}

const items = [...(await verify(IDX, "IDX")), ...(await verify(US, "US"))];
writeFileSync(
  new URL("../src/server/providers/symbol-directory.json", import.meta.url),
  JSON.stringify({ generatedAt: new Date().toISOString(), source: "Yahoo Finance", items }, null, 2) + "\n",
);
console.log(`\n${items.length} symbols written.`);
