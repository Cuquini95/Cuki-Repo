# Vektor Flota

Vista de evaluación para gestión de flota, mantenimiento y abastecimiento. Incluye datos de demostración y guarda los cambios en el navegador.

## Ejecutar

Requiere Node.js 22 (22.12 o posterior).

```sh
npm ci
npm run lint
npm run build
npm run dev
```

Vercel sirve la aplicación Vite desde `dist`. Los roles locales sirven para probar los flujos. El despliegue de evaluación no tiene autenticación multiusuario ni conexión a los registros operativos de Trans Plus.
