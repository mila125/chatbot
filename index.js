const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

exports.dialogflowFirebaseFulfillment = functions.https.onRequest(async (req, res) => {
  const intent = req.body.queryResult?.intent?.displayName;
  const params = req.body.queryResult?.parameters || {};
  const session = req.body.session;

  try {
    if (intent === "hacer pedido") {
      const pedidoInput = params["pedido"];
      const cantidad = params["cantidad"];
      
      if (!pedidoInput || !cantidad) {
        return res.json({
          fulfillmentText: "Por favor indica el producto y la cantidad.",
        });
      }

      // Buscar producto en catálogo de forma flexible
      const catalogoSnap = await db.collection("catalogo").get();
      let productoEncontrado = null;

      catalogoSnap.forEach(doc => {
        const producto = doc.data();
        if (pedidoInput.toLowerCase().includes(producto.nombre.toLowerCase())) {
          productoEncontrado = producto;
        }
      });

      if (!productoEncontrado) {
        return res.json({
          fulfillmentText: `❌ El producto "${pedidoInput}" no está disponible en el catálogo.`,
        });
      }

      return res.json({
        fulfillmentText: `¿Confirmas tu pedido de ${cantidad} ${productoEncontrado.nombre} por $${productoEncontrado.precio}?`,
        outputContexts: [
          {
            name: `${session}/contexts/pedido-pendiente`,
            lifespanCount: 5,
            parameters: {
              pedido: productoEncontrado.nombre,
              precio: productoEncontrado.precio,
              cantidad,
            },
          },
        ],
      });
    }

    if (intent === "confirmar pedido") {
      const context = req.body.queryResult.outputContexts.find(ctx =>
        ctx.name.endsWith("/contexts/pedido-pendiente")
      );
      const data = context?.parameters;

      if (!data || !data.pedido || !data.cantidad || !data.precio) {
        return res.json({
          fulfillmentText: "No se encontraron datos para confirmar el pedido.",
        });
      }

      const pedidosRef = db.collection("pedidos");
      const snapshot = await pedidosRef.get();
      const nuevoID = `pedido${snapshot.size + 1}`;

      // Guardar el pedido en Firestore
      await pedidosRef.doc(nuevoID).set({
        pedido: data.pedido,
        precio: data.precio,
        cantidad: data.cantidad,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.json({
        fulfillmentText: `✅ Tu pedido de ${data.cantidad} ${data.pedido} fue registrado exitosamente como "${nuevoID}".`,
      });
    }

    if (intent === "mostrar catalogo") {
      const catalogoSnap = await db.collection("catalogo").get();

      if (catalogoSnap.empty) {
        return res.json({
          fulfillmentText: "📭 El catálogo está vacío actualmente.",
        });
      }

      let catalogoTexto = "📦 Aquí tienes el catálogo:\n";
      catalogoSnap.forEach(doc => {
        const producto = doc.data();
        catalogoTexto += `• ${producto.nombre} - $${producto.precio}\n`;
      });

      return res.json({
        fulfillmentText: catalogoTexto,
      });
    }

    return res.json({
      fulfillmentText: "No se reconoció la intención.",
    });

  } catch (error) {
    console.error("Error en fulfillment:", error);
    return res.json({
      fulfillmentText: "⚠️ Ocurrió un error procesando tu solicitud.",
    });
  }
});
