const mockUser = {
  id: "guest-user",
  email: "guest@example.com",
  user_metadata: {
    full_name: "Guest Player",
    first_name: "Guest",
    last_name: "Player"
  }
};

const mockProfile = {
  id: mockUser.id,
  username: "Guest",
  credits: 1000,
  carter_cash: 0,
  carter_cash_progress: 0,
  first_name: "Guest",
  last_name: "Player"
};

const mockDatabase = {
  profiles: [mockProfile],
  runs: [],
  prizes: [],
  game_runs: [],
  bet_plays: []
};

function cloneRow(row) {
  return row ? JSON.parse(JSON.stringify(row)) : row;
}

function createQuery(table) {
  let rows = mockDatabase[table] || [];

  const query = {
    select() {
      return query;
    },
    eq(field, value) {
      rows = rows.filter((row) => row && row[field] === value);
      return query;
    },
    order() {
      return query;
    },
    limit(count) {
      const slice = typeof count === "number" ? rows.slice(0, count) : rows;
      return Promise.resolve({ data: cloneRow(slice), error: null });
    },
    maybeSingle() {
      return Promise.resolve({ data: cloneRow(rows[0] || null), error: null });
    },
    single() {
      return Promise.resolve({ data: cloneRow(rows[0] || null), error: null });
    },
    insert(payload) {
      const items = Array.isArray(payload) ? payload : [payload];
      const tableRows = mockDatabase[table];
      if (Array.isArray(tableRows)) {
        for (const item of items) {
          tableRows.push(cloneRow(item));
        }
      }
      return Promise.resolve({ data: cloneRow(items), error: null });
    },
    update(values) {
      return {
        eq(field, value) {
          rows.forEach((row) => {
            if (row && row[field] === value) {
              Object.assign(row, values);
            }
          });
          return Promise.resolve({ data: cloneRow(rows), error: null });
        }
      };
    },
    delete() {
      return {
        eq() {
          rows = [];
          mockDatabase[table] = rows;
          return Promise.resolve({ error: null });
        }
      };
    }
  };

  return query;
}

export const supabase = {
  auth: {
    async getSession() {
      return { data: { session: { user: mockUser } }, error: null };
    },
    async getUser() {
      return { data: { user: mockUser }, error: null };
    },
    onAuthStateChange(callback) {
      const subscription = { unsubscribe() {} };
      if (typeof callback === "function") {
        setTimeout(() => callback("SIGNED_IN", { user: mockUser }), 0);
      }
      return { data: { subscription }, error: null };
    },
    async signInWithPassword() {
      return { data: { user: mockUser }, error: null };
    },
    async signUp() {
      return { data: { user: mockUser }, error: null };
    },
    async signOut() {
      return { error: null };
    }
  },
  from(table) {
    return createQuery(table);
  },
  rpc() {
    return Promise.resolve({ data: null, error: null });
  },
  storage: {
    from() {
      return {
        async upload() {
          return { error: new Error("Storage is disabled in offline mode") };
        },
        getPublicUrl(path) {
          return { data: { publicUrl: path ? `/${path}` : "" }, error: null };
        }
      };
    }
  },
  functions: {
    async invoke() {
      return { data: null, error: null };
    }
  }
};

console.info("[RTN] Supabase client stub initialized (offline mode)");
