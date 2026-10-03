# E-rēķina pārveidotājs

Lokāls web rīks parasta rēķina datu sakārtošanai un PEPPOL BIS Billing 3.0 / UBL XML e-rēķina ģenerēšanai.

## Ko tas dara

- Ielasa rēķina tekstu no kopēta PDF/Word/Excel teksta vai `.txt` faila.
- Mēģina automātiski aizpildīt rēķina numuru, datumus, reģistrācijas/PVN numurus, IBAN un rindas.
- Ļauj cilvēkam labot visus laukus pirms ģenerēšanas.
- Pārbauda biežākās obligātās vērtības.
- Ģenerē lejupielādējamu UBL XML datni.

## Ierobežojumi

Šis nav pilns PEPPOL validatora aizvietotājs un nesūta rēķinu VID, e-adresē vai PEPPOL tīklā. Pirms produkcijas lietošanas XML jāpārbauda ar oficiālu/sertificētu validatoru vai e-rēķinu operatoru.

## Lokāla palaišana

```bash
npm test
npm run serve
```

Pēc tam atver `http://127.0.0.1:5177`.

## Avoti

- VID: https://www.vid.gov.lv/lv/e-rekini
- Latvija.gov.lv e-rēķini e-adresē: https://latvija.gov.lv/Content/Eadr_Erekini
- PEPPOL BIS Billing 3.0 UBL Invoice: https://docs.peppol.eu/poacc/billing/3.0/syntax/ubl-invoice/
- PEPPOL EAS kodi: https://docs.peppol.eu/poac/eu/pint-eu/trn-invoice/codelist/eas/
