export const users = [
  {
    username: "recepcion",
    password: "1234",
    role: "recepcion",
    name: "Recepcion",
    allowedViews: ["inicio", "crear", "buscar", "historial", "seguimiento", "salida"]
  },
  {
    username: "cobranza",
    password: "1234",
    role: "cobranza",
    name: "Cobranza",
    allowedViews: ["inicio", "datosClientes", "buscar", "historial", "seguimiento", "cobranza"]
  },
  {
    username: "jefe",
    password: "1234",
    role: "jefe_taller",
    name: "Jefe de taller",
    allowedViews: ["inicio", "buscar", "historial", "taller", "seguimiento", "cierre", "reportes"],
    canAssignOt: true
  },
  {
    username: "angelf",
    password: "1234",
    role: "mecanico",
    name: "ANGELF",
    mechanicId: "ANGELF",
    allowedViews: ["inicio", "taller", "seguimiento"],
    canAssignOt: false
  },
  {
    username: "fernandos",
    password: "1234",
    role: "mecanico",
    name: "FERNANDOS",
    mechanicId: "FERNANDOS",
    allowedViews: ["inicio", "taller", "seguimiento"],
    canAssignOt: false
  },
  {
    username: "diegom",
    password: "1234",
    role: "mecanico",
    name: "DIEGOM",
    mechanicId: "DIEGOM",
    allowedViews: ["inicio", "crear", "taller", "seguimiento"],
    canAssignOt: false
  },
  {
    username: "jorges",
    password: "1234",
    role: "mecanico",
    name: "JORGES",
    mechanicId: "JORGES",
    allowedViews: ["inicio", "taller", "seguimiento"],
    canAssignOt: false
  },
  {
    username: "joselos",
    password: "1234",
    role: "mecanico",
    name: "JOSELOS",
    mechanicId: "JOSELOS",
    allowedViews: ["inicio", "crear", "taller", "seguimiento"],
    canAssignOt: false
  },
  {
    username: "yong",
    password: "1234",
    role: "mecanico",
    name: "YONG",
    mechanicId: "YONG",
    allowedViews: ["inicio", "taller", "seguimiento"],
    canAssignOt: false
  },
  {
    username: "armandoa",
    password: "1234",
    role: "mecanico",
    name: "ARMANDOA",
    mechanicId: "ARMANDOA",
    allowedViews: ["inicio", "taller", "seguimiento"],
    canAssignOt: false
  },
  {
    username: "admin",
    password: "admin",
    role: "admin",
    name: "Administrador",
    allowedViews: ["inicio", "crear", "buscar", "datosClientes", "historial", "taller", "seguimiento", "cierre", "cobranza", "salida", "reportes", "usuarios"],
    canAssignOt: true
  }
];

export const mechanics = users
  .filter((user) => user.role === "mecanico")
  .map((user) => ({
    id: user.mechanicId,
    name: user.name
  }));

export function authenticateUser(username, password) {
  return (
    users.find(
      (user) =>
        user.username.toLowerCase() === username.trim().toLowerCase() &&
        user.password === password
    ) || null
  );
}




