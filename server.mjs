import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import { JSONFilePreset } from 'lowdb/node';

const root = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(root, '.env') });

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT debe ser un número entre 1 y 65535.');
}

const databasePath = resolve(root, process.env.DB_FILE || 'db.json');
const db = await JSONFilePreset(databasePath, { menu: [], ordenes: [] });

if (!Array.isArray(db.data.menu)) {
    throw new Error('La base de datos debe contener una lista "menu".');
}

if (!Array.isArray(db.data.ordenes)) {
    db.data.ordenes = [];
    await db.write();
}

const app = express();
app.use(express.json({ limit: '100kb' }));
app.use('/css', express.static(resolve(root, 'css')));
app.use('/js', express.static(resolve(root, 'js')));

app.get('/', (req, res) => {
    res.sendFile(resolve(root, 'index.html'));
});

app.get('/db.json', (req, res) => {
    res.sendFile(databasePath);
});

app.get('/api/menu', (req, res) => {
    res.json(db.data.menu);
});

app.get('/api/ordenes', (req, res) => {
    res.json(db.data.ordenes);
});

app.get('/api/ordenes/:id', (req, res) => {
    const orden = db.data.ordenes.find(item => item.id === req.params.id);
    if (!orden) {
        return res.status(404).json({ error: 'No se encontró la orden.' });
    }

    res.json(orden);
});

app.post('/api/ordenes', async (req, res) => {
    const mesa = Number(req.body?.mesa);
    const hora = req.body?.hora;
    const pedidoSolicitado = req.body?.pedido;

    if (!Number.isInteger(mesa) || mesa < 1 || mesa > 8) {
        return res.status(400).json({ error: 'La mesa debe ser un número entero entre 1 y 8.' });
    }

    if (typeof hora !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
        return res.status(400).json({ error: 'La hora no tiene un formato válido.' });
    }

    if (!Array.isArray(pedidoSolicitado) || pedidoSolicitado.length === 0) {
        return res.status(400).json({ error: 'La orden debe incluir al menos un producto.' });
    }

    const cantidadesPorProducto = new Map();
    for (const renglon of pedidoSolicitado) {
        const producto = db.data.menu.find(item => String(item.id) === String(renglon?.id));
        const cantidad = Number(renglon?.cantidad);

        if (!producto || !Number.isSafeInteger(cantidad) || cantidad < 1) {
            return res.status(400).json({ error: 'El pedido contiene un producto o una cantidad inválidos.' });
        }

        const clave = String(producto.id);
        cantidadesPorProducto.set(clave, (cantidadesPorProducto.get(clave) || 0) + cantidad);
    }

    const pedido = Array.from(cantidadesPorProducto, ([id, cantidad]) => {
        const producto = db.data.menu.find(item => String(item.id) === id);
        const precio = Number(producto.precio);

        if (!Number.isFinite(precio) || precio < 0) {
            throw new Error(`El producto ${producto.id} tiene un precio inválido.`);
        }

        return {
            id: producto.id,
            nombre: producto.nombre,
            categoria: producto.categoria,
            precio,
            cantidad,
            subtotal: Number((precio * cantidad).toFixed(2))
        };
    });

    const orden = {
        id: randomUUID(),
        mesa,
        hora,
        pedido,
        total: Number(pedido.reduce((suma, item) => suma + item.subtotal, 0).toFixed(2)),
        estado: 'pendiente',
        creadaEn: new Date().toISOString()
    };

    db.data.ordenes.push(orden);
    await db.write();
    res.status(201).json(orden);
});

app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada.' });
});

app.use((error, req, res, next) => {
    console.error(error);
    if (res.headersSent) {
        return next(error);
    }

    const status = Number.isInteger(error.status) ? error.status : 500;
    res.status(status).json({
        error: status < 500 ? error.message : 'Error interno del servidor.'
    });
});

app.listen(port, () => {
    console.log(`Aplicación y API disponibles en http://localhost:${port}`);
});
