# Auto-inicio del proyecto en Raspberry Pi (systemd)

Instala `soni-footsteps.service` (misma carpeta) para que la Pi arranque sola con el servidor Soundworks + cliente device al encender.

## Requisitos previos en cada Pi

- Proyecto ubicado en `/home/pi/projects/SoniFootstepsRaramuri`.
- Dependencias instaladas y build generado (`npm install` y `npm run build`).
- Usuario `pi` (UID `1000`) y runtime de usuario disponible en `/run/user/1000`.

## Instalación

Desde el Mac:

```bash
scp documentation/deployment/soni-footsteps.service pi@<host>:/tmp/
```

Y en la Pi:

```bash
sudo cp /tmp/soni-footsteps.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now soni-footsteps
```

## Verificación

```bash
systemctl is-active soni-footsteps            # → active
ss -tln | grep 8000                           # → *:8000 LISTEN
sudo journalctl -u soni-footsteps -n 30       # sin errores ALSA
```

## Notas

- `ExecStart=/usr/bin/npm run start` equivale a `concurrently -i -p "none" "node .build/server.js" "node .build/clients/device.js"` (`package.json` ya modificado). No usar `--kill-others`.
- Se incluye `Environment=XDG_RUNTIME_DIR=/run/user/1000`: sin él, cpal/ALSA no llega al socket de PipeWire (`snd_pcm_open ... Host is down`) y el server/device abortan al arrancar como servicio.
- Los R-IoT deben estar conectados físicamente antes de usarlos; sin IMUs el script no dispara sonido (no es un fallo del servicio).
- La IP de la Pi es dinámica (DHCP, y puede cambiar según el módem al que se conecte). Para un punto fijo accesible por navegador/dotpi-manager, fijar IP estática en NetworkManager o reserva DHCP en el router.
- Rollback: `sudo systemctl disable --now soni-footsteps && sudo rm /etc/systemd/system/soni-footsteps.service && sudo systemctl daemon-reload`