import { SiteReferenceItem } from '../types';

export const DEFAULT_SITELIST_CSV = `Cluster ID,Cluster Name,Region,Kecamatan,Inisial Name Cluster,No. FDT ID,HP DRM,Coding FDT  (FDT  ID),OLT NAME
CLRM07-99-023,KELURAHAN KENTONG BLORA,BLORA,Cepu,CPU,D01,545,BLA-CPU-D01,BALUN
CLRM07-99-016,KELURAHAN CABEAN BLORA,BLORA,Cepu,CPU,D02,323,BLA-CPU-D02,BALUN
CLRM07-99-016,KELURAHAN CABEAN BLORA,BLORA,Cepu,CPU,D03,299,BLA-CPU-D03,BALUN
CLRM07-99-016,KELURAHAN CABEAN BLORA,BLORA,Cepu,CPU,D04,208,BLA-CPU-D04,BALUN
CLRM07-99-021,KELURAHAN KAPUAN BLORA,BLORA,Cepu,CPU,D05,336,BLA-CPU-D05,BALUN
CLRM07-99-024,KELURAHAN MERNUNG BLORA,BLORA,Cepu,CPU,D06,454,BLA-CPU-D06,BALUN
CLRM07-99-025,KELURAHAN MULYOREJO BLORA,BLORA,Cepu,CPU,D07,291,BLA-CPU-D07,BALUN
CLRM07-99-025,KELURAHAN MULYOREJO BLORA,BLORA,Cepu,CPU,D08,63,BLA-CPU-D08,BALUN
CLRM07-99-031,KELURAHAN TAMBAKROMO BLORA,BLORA,Cepu,CPU,D09,348,BLA-CPU-D09,BALUN
CLRM07-99-031,KELURAHAN TAMBAKROMO BLORA,BLORA,Cepu,CPU,D10,411,BLA-CPU-D10,BALUN
CLRM07-99-031,KELURAHAN TAMBAKROMO BLORA,BLORA,Cepu,CPU,D11,257,BLA-CPU-D11,BALUN
CLRM07-99-031,KELURAHAN TAMBAKROMO BLORA,BLORA,Cepu,CPU,D12,382,BLA-CPU-D12,BALUN
CLRM07-99-015,KELURAHAN BALUN BLORA,BLORA,Cepu,CPU,D13,475,BLA-CPU-D13,BALUN
CLRM07-99-015,KELURAHAN BALUN BLORA,BLORA,Cepu,CPU,D14,248,BLA-CPU-D14,BALUN
CLRM07-99-015,KELURAHAN BALUN BLORA,BLORA,Cepu,CPU,D15,224,BLA-CPU-D15,BALUN
CLRM07-99-015,KELURAHAN BALUN BLORA,BLORA,Cepu,CPU,D16,445,BLA-CPU-D16,BALUN
CLRM07-99-015,KELURAHAN BALUN BLORA,BLORA,Cepu,CPU,D17,561,BLA-CPU-D17,BALUN
CLRM07-99-015,KELURAHAN BALUN BLORA,BLORA,Cepu,CPU,D18,335,BLA-CPU-D18,BALUN
CLRM07-99-015,KELURAHAN BALUN BLORA,BLORA,Cepu,CPU,D19,338,BLA-CPU-D19,BALUN
CLRM07-99-015,KELURAHAN BALUN BLORA,BLORA,Cepu,CPU,D20,180,BLA-CPU-D20,BALUN
CLRM07-99-015,KELURAHAN BALUN BLORA,BLORA,Cepu,CPU,D21,266,BLA-CPU-D21,BALUN
CLRM07-99-015,KELURAHAN BALUN BLORA,BLORA,Cepu,CPU,D22,270,BLA-CPU-D22,BALUN
CLRM07-99-015,KELURAHAN BALUN BLORA,BLORA,Cepu,CPU,D23,426,BLA-CPU-D23,BALUN
CLRM07-99-015,KELURAHAN BALUN BLORA,BLORA,Cepu,CPU,D24,64,BLA-CPU-D24,BALUN
CLRM07-99-027,KELURAHAN NGLANJUK BLORA,BLORA,Cepu,CPU,D25,421,BLA-CPU-D25,BALUN
CLRM07-99-027,KELURAHAN NGLANJUK BLORA,BLORA,Cepu,CPU,D26,275,BLA-CPU-D26,BALUN
CLRM07-99-019,KELURAHAN GETAS BLORA,BLORA,Cepu,CPU,D27,561,BLA-CPU-D27,BALUN
CLRM07-99-019,KELURAHAN GETAS BLORA,BLORA,Cepu,CPU,D28,377,BLA-CPU-D28,BALUN
CLRM07-99-017,KELURAHAN CEPU BLORA,BLORA,Cepu,CPU,D29,463,BLA-CPU-D29,BALUN
CLRM07-99-017,KELURAHAN CEPU BLORA,BLORA,Cepu,CPU,D30,217,BLA-CPU-D30,BALUN
CLRM07-99-017,KELURAHAN CEPU BLORA,BLORA,Cepu,CPU,D31,132,BLA-CPU-D31,BALUN
CLRM07-99-017,KELURAHAN CEPU BLORA,BLORA,Cepu,CPU,D32,151,BLA-CPU-D32,BALUN
CLRM07-99-017,KELURAHAN CEPU BLORA,BLORA,Cepu,CPU,D33,302,BLA-CPU-D33,BALUN
CLRM07-99-017,KELURAHAN CEPU BLORA,BLORA,Cepu,CPU,D34,465,BLA-CPU-D34,BALUN
CLRM07-99-017,KELURAHAN CEPU BLORA,BLORA,Cepu,CPU,D35,188,BLA-CPU-D35,BALUN
CLRM07-99-017,KELURAHAN CEPU BLORA,BLORA,Cepu,CPU,D36,311,BLA-CPU-D36,BALUN
CLRM07-99-017,KELURAHAN CEPU BLORA,BLORA,Cepu,CPU,D37,256,BLA-CPU-D37,BALUN
CLRM07-99-018,KELURAHAN GADON BLORA,BLORA,Cepu,CPU,D38,142,BLA-CPU-D38,BALUN
CLRM07-99-020,KELURAHAN JIPANG BLORA,BLORA,Cepu,CPU,D39,155,BLA-CPU-D39,BALUN
CLRM07-99-020,KELURAHAN JIPANG BLORA,BLORA,Cepu,CPU,D40,252,BLA-CPU-D40,BALUN
CLRM07-99-021,KELURAHAN KAPUAN BLORA,BLORA,Cepu,CPU,D41,369,BLA-CPU-D41,BALUN
CLRM07-99-028,KELURAHAN NGLORAM BLORA,BLORA,Cepu,CPU,D42,310,BLA-CPU-D42,BALUN
CLRM07-99-028,KELURAHAN NGLORAM BLORA,BLORA,Cepu,CPU,D43,231,BLA-CPU-D43,BALUN
CLRM07-99-030,KELURAHAN SUMBERPITU BLORA,BLORA,Cepu,CPU,D44,310,BLA-CPU-D44,BALUN
CLRM07-99-026,KELURAHAN NGELO BLORA,BLORA,Cepu,CPU,D45,407,BLA-CPU-D45,BALUN
CLRM07-99-026,KELURAHAN NGELO BLORA,BLORA,Cepu,CPU,D46,236,BLA-CPU-D46,BALUN
CLRM07-99-022,KELURAHAN KARANGBOYO BLORA,BLORA,Cepu,CPU,D47,281,BLA-CPU-D47,BALUN
CLRM07-99-022,KELURAHAN KARANGBOYO BLORA,BLORA,Cepu,CPU,D48,475,BLA-CPU-D48,BALUN
CLRM07-99-022,KELURAHAN KARANGBOYO BLORA,BLORA,Cepu,CPU,D49,322,BLA-CPU-D49,BALUN
CLRM07-99-022,KELURAHAN KARANGBOYO BLORA,BLORA,Cepu,CPU,D50,354,BLA-CPU-D50,BALUN
CLRM07-99-022,KELURAHAN KARANGBOYO BLORA,BLORA,Cepu,CPU,D51,316,BLA-CPU-D51,BALUN
CLRM07-99-022,KELURAHAN KARANGBOYO BLORA,BLORA,Cepu,CPU,D52,128,BLA-CPU-D52,BALUN
CLRM07-99-029,KELURAHAN NGROTO BLORA,BLORA,Cepu,CPU,D53,416,BLA-CPU-D53,BALUN
CLRM07-99-029,KELURAHAN NGROTO BLORA,BLORA,Cepu,CPU,D54,269,BLA-CPU-D54,BALUN
CLRM07-99-063,KELURAHAN KALEN BLORA,BLORA,Kedung Tuban,KDT,,,,
CLRM07-99-066,KELURAHAN NGLANDEYAN BLORA,BLORA,Kedung Tuban,KDT,,,,
CLRM07-99-077,KELURAHAN KEMANTREN BLORA,BLORA,Kedung Tuban,KDT,,,,
CLRM07-99-078,KELURAHAN KLAGEN BLORA,BLORA,Kedung Tuban,KDT,,,,`;

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseSiteListCsv(csvText: string): SiteReferenceItem[] {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  // Detect delimiter (comma or semicolon)
  const firstLine = lines[0];
  const delimiter =
    firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';

  // Skip header if first row starts with "Cluster ID"
  const startIdx = /^cluster\s*id/i.test(firstLine) ? 1 : 0;

  const items: SiteReferenceItem[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delimiter);
    const clusterId = (cols[0] ?? '').trim();
    const clusterName = (cols[1] ?? '').trim();
    const region = (cols[2] ?? '').trim();
    const kecamatan = (cols[3] ?? '').trim();
    const clusterInitial = (cols[4] ?? '').trim();
    const fdtNo = (cols[5] ?? '').trim();
    const hpDrm = (cols[6] ?? '').trim();
    const fdtId = (cols[7] ?? '').trim();
    const oltName = (cols[8] ?? '').trim();

    if (!clusterId && !clusterName && !fdtId) continue;

    items.push({
      id: `site-${i}-${clusterId || 'c'}-${fdtId || fdtNo || i}`,
      clusterId,
      clusterName,
      region,
      kecamatan,
      clusterInitial,
      fdtNo,
      hpDrm,
      fdtId,
      oltName,
    });
  }

  return items;
}

export function exportSiteListToCsv(items: SiteReferenceItem[]): string {
  const header =
    'Cluster ID,Cluster Name,Region,Kecamatan,Inisial Name Cluster,No. FDT ID,HP DRM,Coding FDT  (FDT  ID),OLT NAME';
  const rows = items.map((it) =>
    [
      it.clusterId,
      it.clusterName,
      it.region,
      it.kecamatan,
      it.clusterInitial,
      it.fdtNo,
      it.hpDrm,
      it.fdtId,
      it.oltName,
    ]
      .map((val) => (val.includes(',') ? `"${val}"` : val))
      .join(',')
  );
  return [header, ...rows].join('\n');
}

export const DEFAULT_SITE_REFERENCES: SiteReferenceItem[] =
  parseSiteListCsv(DEFAULT_SITELIST_CSV);

export interface ClusterSummaryOption {
  clusterId: string;
  clusterName: string;
  region: string;
  oltName: string;
  kecamatan: string;
  fdtIds: string[];
}

export function buildSiteReferenceLookups(sites: SiteReferenceItem[]) {
  const regionsSet = new Set<string>();
  const oltsSet = new Set<string>();
  const clusterMap = new Map<string, ClusterSummaryOption>();
  const fdtList: SiteReferenceItem[] = [];

  for (const s of sites) {
    if (s.region) regionsSet.add(s.region);
    if (s.oltName) oltsSet.add(s.oltName);
    if (s.fdtId) fdtList.push(s);

    const key = `${s.clusterId}||${s.clusterName}`;
    const existing = clusterMap.get(key);
    if (!existing) {
      clusterMap.set(key, {
        clusterId: s.clusterId,
        clusterName: s.clusterName,
        region: s.region,
        oltName: s.oltName,
        kecamatan: s.kecamatan,
        fdtIds: s.fdtId ? [s.fdtId] : [],
      });
    } else {
      if (!existing.region && s.region) existing.region = s.region;
      if (!existing.oltName && s.oltName) existing.oltName = s.oltName;
      if (s.fdtId && !existing.fdtIds.includes(s.fdtId)) {
        existing.fdtIds.push(s.fdtId);
      }
    }
  }

  const clusters = Array.from(clusterMap.values()).sort((a, b) =>
    a.clusterId.localeCompare(b.clusterId)
  );
  const clustersByName = [...clusters].sort((a, b) =>
    a.clusterName.localeCompare(b.clusterName)
  );
  const regions = Array.from(regionsSet).sort();
  const oltNames = Array.from(oltsSet).sort();

  return {
    regions,
    oltNames,
    clusters,
    clustersByName,
    fdtList,
  };
}
