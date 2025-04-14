const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

exports.dialogflowFirebaseFulfillment = functions.https.onRequest(async (request, response) => {
  const intent = request.body.queryResult?.intent?.displayName;
  const parameters = request.body.queryResult?.parameters;

  try {
    switch (intent) {
      case "hacer pedido":
        const producto = parameters?.producto;
        const cantidad = parameters?.cantidad;

        if (!producto || !cantidad) {
          return response.json({
            fulfillmentText: "Por favor, proporciona el nombre del producto y la cantidad.",
          });
        }

        // Guardar el pedido en Firestore
        await db.collection("pedidos").add({
          producto: producto,
          cantidad: cantidad,
          fecha: admin.firestore.FieldValue.serverTimestamp(),
        });

        return response.json({
          fulfillmentText: `🛍️ Tu pedido de ${cantidad} ${producto}(s) ha sido procesado con éxito.`,
        });

      case "mostrar catalogo":
        const snapshot = await db.collection("catalogo").get();

        if (snapshot.empty) {
          return response.json({
            fulfillmentText: "No hay productos disponibles en el catálogo en este momento.",
          });
        }

        const productos = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          productos.push(`${data.nombre} - $${data.precio}`);
        });

        return response.json({
          fulfillmentText: `🛒 Aquí tienes el catálogo:\n\n${productos.join('\n')}`,
        });

      default:
        return response.json({
          fulfillmentText: "No se reconoció la intención.",
        });
    }
  } catch (error) {
    console.error("❌ Error en el fulfillment:", error);
    return response.json({
      fulfillmentText: "Ocurrió un error al procesar tu solicitud.",
    });
  }
});