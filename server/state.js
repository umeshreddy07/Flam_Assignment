exports.state = {
  ops: [],
  users: new Map(),
  usersArr() { return [...this.users.values()]; },
  newID() { return Date.now() + "-" + Math.random(); },
  addUser(id, name) {
    this.users.set(id, { userId: id, name, color: this.randomColor() });
  },
  randomColor() {
    const c = ["#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#007aff", "#5856d6"];
    return c[Math.floor(Math.random() * c.length)];
  }
};
