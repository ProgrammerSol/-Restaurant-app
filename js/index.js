const btnGuardarCliente = document.querySelector('#guardar-cliente');
const formulario = document.querySelector('#formulario form');
const seccionMenu = document.querySelector('#menu');
const contenidoMenu = document.querySelector('#menu .contenido');
const seccionResumen = document.querySelector('#resumen');
const contenidoResumen = document.querySelector('#resumen .contenido');
const btnGuardarOrden = document.querySelector('#guardar-orden');
const mensajeOrden = document.querySelector('#mensaje-orden');
const claveOrdenes = 'restaurant-app-ordenes';

const cliente = {
    mesa: '',
    hora: '',
    pedido: [],
    guardada: false
};

const categorias = {
    1: 'pizza',
    2: 'postres',
    3: 'jugos',
    4: 'comida',
    5: 'cafe'
};

btnGuardarCliente.addEventListener('click', guardarCliente);
btnGuardarOrden.addEventListener('click', guardarOrden);

function mostrarAlerta(mensaje, tipo = 'danger') {
    limpiarAlerta();

    const alerta = document.createElement('div');
    alerta.classList.add('alert', `alert-${tipo}`, 'text-center', 'mt-3');
    alerta.setAttribute('role', 'alert');
    alerta.textContent = mensaje;
    formulario.appendChild(alerta);
}

function limpiarAlerta() {
    const alerta = formulario.querySelector('.alert');
    if (alerta) {
        alerta.remove();
    }
}

async function guardarCliente() {
    const mesa = document.querySelector('#mesa').value;
    const hora = document.querySelector('#hora').value;

    if (!mesa || !hora) {
        mostrarAlerta('Todos los campos son obligatorios.');
        return;
    }

    if (Number(mesa) < 1 || Number(mesa) > 8) {
        mostrarAlerta('La mesa debe estar entre 1 y 8.');
        return;
    }

    cliente.mesa = mesa;
    cliente.hora = hora;
    cliente.guardada = false;
    btnGuardarCliente.disabled = true;
    mostrarAlerta('Cargando el menú...', 'info');

    try {
        const respuesta = await fetch('db.json');
        if (!respuesta.ok) {
            throw new Error(`No se pudo cargar db.json: estado ${respuesta.status}.`);
        }

        const datos = await respuesta.json();
        if (!Array.isArray(datos.menu)) {
            throw new Error('db.json no contiene una lista de productos.');
        }

        cliente.pedido = [];
        mensajeOrden.textContent = '';
        mensajeOrden.className = 'mt-3';
        mostrarMenu(datos.menu);
        mostrarSecciones();
        mostrarResumen();
        limpiarAlerta();
        bootstrap.Modal.getOrCreateInstance(document.querySelector('#formulario')).hide();
    } catch (error) {
        console.error('No se pudo cargar el menú:', error);
        mostrarAlerta('No se pudo cargar el menú. Verifica que db.json esté incluido en el sitio publicado.');
    } finally {
        btnGuardarCliente.disabled = false;
    }
}

function mostrarMenu(menu) {
    contenidoMenu.replaceChildren();

    const tablaResponsive = document.createElement('div');
    tablaResponsive.classList.add('table-responsive');

    const tabla = document.createElement('table');
    tabla.classList.add('table', 'table-striped', 'align-middle');

    const encabezado = document.createElement('thead');
    const filaEncabezado = document.createElement('tr');

    ['Producto', 'Categoría', 'Precio', 'Cantidad'].forEach(titulo => {
        const celda = document.createElement('th');
        celda.scope = 'col';
        celda.textContent = titulo;
        filaEncabezado.appendChild(celda);
    });

    encabezado.appendChild(filaEncabezado);

    const cuerpoTabla = document.createElement('tbody');

    menu.forEach(producto => {
        const fila = document.createElement('tr');
        const nombre = document.createElement('td');
        nombre.textContent = producto.nombre;

        const categoria = document.createElement('td');
        categoria.textContent = categorias[producto.categoria] || 'Sin categoría';

        const precio = document.createElement('td');
        precio.textContent = `$${producto.precio}`;

        const inputCantidad = document.createElement('input');
        inputCantidad.type = 'number';
        inputCantidad.min = 0;
        inputCantidad.step = 1;
        inputCantidad.value = 0;
        inputCantidad.id = `producto-${producto.id}`;
        inputCantidad.classList.add('form-control', 'form-control-sm');
        inputCantidad.setAttribute('aria-label', `Cantidad de ${producto.nombre}`);
        inputCantidad.addEventListener('change', () => {
            const cantidad = Number(inputCantidad.value);

            if (!Number.isInteger(cantidad) || cantidad < 0) {
                inputCantidad.value = '0';
                actualizarCantidadPedido(producto, 0);
                return;
            }

            actualizarCantidadPedido(producto, cantidad);
        });

        const celdaCantidad = document.createElement('td');
        celdaCantidad.appendChild(inputCantidad);

        fila.append(nombre, categoria, precio, celdaCantidad);
        cuerpoTabla.appendChild(fila);
    });

    tabla.append(encabezado, cuerpoTabla);
    tablaResponsive.appendChild(tabla);
    contenidoMenu.appendChild(tablaResponsive);
}

function mostrarSecciones() {
    seccionMenu.classList.remove('d-none');
    seccionResumen.classList.remove('d-none');
}

function actualizarCantidadPedido(producto, cantidad) {
    const indiceProducto = cliente.pedido.findIndex(item => item.id === producto.id);

    if (cantidad === 0) {
        if (indiceProducto !== -1) {
            cliente.pedido.splice(indiceProducto, 1);
        }
    } else if (indiceProducto === -1) {
        cliente.pedido.push({ ...producto, cantidad });
    } else {
        cliente.pedido[indiceProducto].cantidad = cantidad;
    }

    mostrarResumen();
}

function mostrarResumen() {
    contenidoResumen.replaceChildren();

    if (cliente.pedido.length === 0) {
        btnGuardarOrden.hidden = true;
        const mensaje = document.createElement('p');
        mensaje.classList.add('text-center');
        mensaje.textContent = 'Añade los elementos del pedido';
        contenidoResumen.appendChild(mensaje);
        return;
    }

    btnGuardarOrden.hidden = false;
    btnGuardarOrden.disabled = Boolean(cliente.guardada);
    btnGuardarOrden.textContent = cliente.guardada ? 'Orden guardada' : 'Guardar orden';

    let total = 0;

    cliente.pedido.forEach(producto => {
        const subtotal = Number(producto.precio) * producto.cantidad;
        total += subtotal;

        const fila = document.createElement('div');
        fila.classList.add('col-12', 'd-flex', 'justify-content-between', 'border-bottom', 'py-2');

        const descripcion = document.createElement('span');
        descripcion.textContent = `${producto.nombre} x ${producto.cantidad}`;

        const precio = document.createElement('span');
        precio.textContent = `$${subtotal}`;

        fila.append(descripcion, precio);
        contenidoResumen.appendChild(fila);
    });

    const totalPedido = document.createElement('p');
    totalPedido.classList.add('col-12', 'text-end', 'fw-bold', 'mt-3');
    totalPedido.textContent = `Total: $${total}`;
    contenidoResumen.appendChild(totalPedido);
}

function guardarOrden() {
    if (cliente.pedido.length === 0 || !cliente.mesa || !cliente.hora) {
        return;
    }

    btnGuardarOrden.disabled = true;
    mensajeOrden.textContent = '';
    mensajeOrden.className = 'mt-3';

    try {
        const mesa = Number(cliente.mesa);
        if (!Number.isInteger(mesa) || mesa < 1 || mesa > 8) {
            throw new Error('La mesa debe ser un número entero entre 1 y 8.');
        }

        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(cliente.hora)) {
            throw new Error('La hora no tiene un formato válido.');
        }

        const pedido = cliente.pedido.map(producto => {
            const cantidad = Number(producto.cantidad);
            const precio = Number(producto.precio);
            if (!Number.isSafeInteger(cantidad) || cantidad < 1 || !Number.isFinite(precio) || precio < 0) {
                throw new Error('El pedido contiene un producto o una cantidad inválidos.');
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
        const total = Number(pedido.reduce((suma, producto) => suma + producto.subtotal, 0).toFixed(2));
        const orden = {
            id: crypto.randomUUID(),
            mesa,
            hora: cliente.hora,
            pedido,
            total,
            estado: 'pendiente',
            creadaEn: new Date().toISOString()
        };
        const ordenesGuardadas = JSON.parse(localStorage.getItem(claveOrdenes) || '[]');
        if (!Array.isArray(ordenesGuardadas)) {
            throw new Error('No se pudieron leer las órdenes guardadas en este navegador.');
        }

        ordenesGuardadas.push(orden);
        localStorage.setItem(claveOrdenes, JSON.stringify(ordenesGuardadas));

        cliente.guardada = true;
        document.querySelectorAll('#menu input[type="number"]').forEach(input => {
            input.disabled = true;
        });
        mostrarResumen();
        mensajeOrden.className = 'alert alert-success mt-3';
        mensajeOrden.textContent = `Orden ${orden.id} guardada en este navegador. Total: $${orden.total}.`;
    } catch (error) {
        console.error('No se pudo guardar la orden:', error);
        mensajeOrden.className = 'alert alert-danger mt-3';
        mensajeOrden.textContent = error.message || 'No se pudo guardar la orden.';
        btnGuardarOrden.disabled = false;
    }
}