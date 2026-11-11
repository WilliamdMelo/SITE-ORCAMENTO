# Configuração da rota automática

## Google Cloud

1. Crie ou selecione um projeto no Google Cloud.
2. Habilite `Places API (New)`, `Maps JavaScript API` e `Routes API`.
3. Crie uma chave de navegador para Places/Maps JavaScript e restrinja-a aos domínios da Vercel e aos ambientes locais autorizados.
4. Crie uma chave de servidor separada, restrita somente à `Routes API`.
5. Configure faturamento e uma quota diária para controlar o consumo.

## Frontend

Copie `maps-config.example.js` para `maps-config.js` e informe a chave de navegador. O arquivo `maps-config.js` está no `.gitignore` e não deve ser commitado.

## Supabase

Configure o segredo da Edge Function:

```text
GOOGLE_MAPS_SERVER_KEY=<chave restrita à Routes API>
```

A função usa como origem fixa:

```text
Parque Empresarial Arnaldo - Rua Alberto Tibúrcio Peixoto, R. Euclídes Francisco Peixoto, nº 271, Tijucas - SC, 88207-899
```

Sem a chave configurada, o sistema mantém o preenchimento manual de quilômetros e horas sem interromper o orçamento.
