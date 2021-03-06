var app = require("../../server/server");
const admin = require("firebase-admin");
var constructorConsulta = require('../util/ConstructorConsultaUtil');

const USUARIOXNOTIFICACION_COLECCION = "usuarioXnotificacion";
var ServicioUsuario = require("../servicios/ServicioUsuario");

//clase que realizar operaciones a la BD

class ServicioNotificacion {
  constructor() {
    this.bd = admin.firestore();
  }

  //Método que guarda la notificación en la BD, en el modelo notificacion.
  guardarNotificacion(notificacion, cb) {
    var notificacionModel = app.models.notificacion;
    notificacionModel.create(notificacion, (err, modelo) => {
      if (err) {
        console.log("No se pudo crear la notificación " + err);
        cb(err, null);
      } else {
        cb(null, modelo);
      }
    });
  }


 // Método que asocia la notificación con cada usuario. Se almacena en el modelo usuarioXnotificaciones
  asociarNotificacionAUsuarios(idNotificacion,usuariosConPermisos,cb) {
    var usuarioXnotificacionModel = app.models.usuarioXnotificacion;
    const servicioUsuario = new ServicioUsuario();
    var usuarioXNotificacionLista = [];

    servicioUsuario.encontrarUsuarios(usuariosConPermisos,(err, correosLista) => {
      correosLista.forEach((id, ind, array) => {
        var usuarioXnotificacion = {
          usuarioId: id,
          notificacionId: idNotificacion,
          fecha: Date.now(),
          leido: false
        };
        usuarioXnotificacionModel.create(
          usuarioXnotificacion,
          (err, modelo) => {
            if (err) {
              console.log(
                "No se pudo asociar la notificacion " +
                  usuarioXnotificacion.notificacionId +
                  " al usuario " +
                  usuarioXnotificacion.usuarioId +
                  " " +
                  err
              );
            }else{
              usuarioXNotificacionLista.push(modelo)
            }
            if (ind == array.length - 1 && cb) {
              cb(usuarioXNotificacionLista);
            }
          }
        );
      });
    });
  }

  /*Metodo que retorna en su callback "cb" las notificiaciones que pertenecen a un "correo",
  o las notificiones leidas o no leidas por medio del parametro opcional "leido"   */
  obtenerNotificaciones(correo, leido,paginacion, cb) {
    var notificacionModel = app.models.notificacion;
    const servicioUsuario = new ServicioUsuario();
    var notificaciones = [];
    var notificacionesData = [];

    servicioUsuario.encontrarUsuario(correo, (err, usuario) => {
      if (err) {
        console.log("No se pudo obtener el usuario " + correo + " " + err);
      }

      if (usuario == undefined || usuario == null) {
        cb({ mensaje: "El usuario no existe" },null );
        return;
      } else {
        var consulta = this.bd
          .collection(USUARIOXNOTIFICACION_COLECCION)
          .where("usuarioId", "==", usuario.correo);

        if (leido || leido != null) {
          consulta = consulta.where("leido", "==", leido);
        }

        constructorConsulta.construirConFiltros(consulta,paginacion,USUARIOXNOTIFICACION_COLECCION, (consultaFinal,ultimo) => {
          if(ultimo){
            consultaFinal = consultaFinal.orderBy('fecha','desc').startAfter(ultimo)
          }else{
            consultaFinal = consultaFinal.orderBy('fecha','desc')
          }

          consultaFinal
          .get()
          .then((notificacionesId) => {
            if (notificacionesId.empty) {
              cb(null, notificaciones);
            } else {
              notificacionesId.forEach((res) => {
                notificaciones.push({
                  id: res.id,
                  notificacionId: res.data().notificacionId
                });
              });
              var numNotificaciones = 0;
              notificaciones.forEach((item, ind, array) => {
                notificacionModel.findById(item.notificacionId, (err, notificacion) => {
                  if (err) {
                    console.log(
                      "No se puede obtener la notificacion " +
                        item.notificacionId +
                        " " +
                        err
                    );
                  } else {
                    notificacion.id = item.id
                    notificacionesData[ind]= notificacion;
                  }
                  numNotificaciones++;
                  if (numNotificaciones == array.length) {
                    notificacionesData.forEach(n =>{
                      n.fecha = n.fecha.toDate()
                    })
                    cb(null, notificacionesData);
                  }
                });
              });
            }
          })
          .catch((err) => {
            console.log(
              "No se pudo retornar las notificaciones del usuario " +
                correo +
                " " +
                err
            );
            cb(err, null);
          });

        })
      }
    });
  }
}
module.exports = ServicioNotificacion;
