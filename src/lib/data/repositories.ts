import { ensureMigrations, getDb, type SqlClient } from "@/lib/db";
import { encodeJson, type SqlValue } from "@/lib/db/sql-client";
import { newId } from "@/lib/utils/ids";
import type { Place, Visit, FoodItem } from "@/lib/domain/types";
import {
  FOOD_ITEM_COLUMNS,
  PLACE_COLUMNS,
  PLACE_FIELD_MAP,
  PLACE_JSON_FIELDS,
  VISIT_COLUMNS,
  toFoodItem,
  toPlace,
  toVisit,
  type FoodItemRow,
  type PlaceRefreshRow,
  type PlaceRow,
  type SessionRow,
  type UserRow,
  type VisitRow,
} from "./rows";

/**
 * Repository layer: the only place that knows SQL. Services and UI speak in
 * domain objects.
 */
export function createRepositories(db: SqlClient = getDb()) {
  const users = {
    async findByEmail(email: string) {
      return db.get<UserRow>("select * from users where lower(email) = lower(?)", [email]);
    },
    async findById(id: string) {
      return db.get<UserRow>("select * from users where id = ?", [id]);
    },
    async create(input: {
      email: string;
      name: string;
      passwordHash: string | null;
      isDemo?: boolean;
    }) {
      const id = newId("usr");
      const now = new Date().toISOString();
      await db.run(
        "insert into users (id, email, name, password_hash, is_demo, created_at) values (?, ?, ?, ?, ?, ?)",
        [id, input.email.trim().toLowerCase(), input.name.trim(), input.passwordHash, input.isDemo ? 1 : 0, now],
      );
      return (await users.findById(id)) as UserRow;
    },
    async updatePassword(id: string, passwordHash: string) {
      await db.run("update users set password_hash = ? where id = ?", [passwordHash, id]);
    },
    async delete(id: string) {
      await db.run("delete from users where id = ?", [id]);
    },
  };

  const sessions = {
    async create(input: { userId: string; tokenHash: string; expiresAt: string; userAgent?: string | null }) {
      const id = newId("ses");
      await db.run(
        "insert into sessions (id, user_id, token_hash, created_at, expires_at, user_agent) values (?, ?, ?, ?, ?, ?)",
        [
          id,
          input.userId,
          input.tokenHash,
          new Date().toISOString(),
          input.expiresAt,
          input.userAgent ?? null,
        ],
      );
      return id;
    },
    async findValid(tokenHash: string) {
      const session = await db.get<SessionRow>(
        "select * from sessions where token_hash = ? and expires_at > ?",
        [tokenHash, new Date().toISOString()],
      );
      if (!session) return null;
      const user = await db.get<UserRow>("select * from users where id = ?", [session.user_id]);
      if (!user) return null;
      return { session, user };
    },
    async deleteById(id: string) {
      await db.run("delete from sessions where id = ?", [id]);
    },
    async deleteByTokenHash(tokenHash: string) {
      await db.run("delete from sessions where token_hash = ?", [tokenHash]);
    },
    async deleteExpired() {
      await db.run("delete from sessions where expires_at <= ?", [new Date().toISOString()]);
    },
  };

  const places = {
    async listByUser(userId: string): Promise<Place[]> {
      const rows = await db.all<PlaceRow>(
        `select ${PLACE_COLUMNS} from places where user_id = ? order by name asc`,
        [userId],
      );
      return rows.map(toPlace);
    },
    async findById(userId: string, id: string): Promise<Place | null> {
      const row = await db.get<PlaceRow>(
        `select ${PLACE_COLUMNS} from places where user_id = ? and id = ?`,
        [userId, id],
      );
      return row ? toPlace(row) : null;
    },
    async findByProviderId(
      userId: string,
      provider: string,
      providerPlaceId: string,
    ): Promise<Place | null> {
      const row = await db.get<PlaceRow>(
        `select ${PLACE_COLUMNS} from places where user_id = ? and provider = ? and provider_place_id = ?`,
        [userId, provider, providerPlaceId],
      );
      return row ? toPlace(row) : null;
    },
    async insert(place: Place): Promise<Place> {
      await db.run(
        `insert into places (${PLACE_COLUMNS}) values (${columnPlaceholders(PLACE_COLUMNS)})`,
        placeValues(place),
      );
      return place;
    },
    async update(userId: string, id: string, patch: Partial<Place>): Promise<Place | null> {
      const { assignments, values } = placeAssignments(patch);
      if (assignments.length === 0) return places.findById(userId, id);
      await db.run(`update places set ${assignments.join(", ")} where user_id = ? and id = ?`, [
        ...values,
        userId,
        id,
      ]);
      return places.findById(userId, id);
    },
    async delete(userId: string, id: string): Promise<void> {
      await db.run("delete from places where user_id = ? and id = ?", [userId, id]);
    },
    async countByUser(userId: string): Promise<number> {
      const row = await db.get<{ count: number }>(
        "select count(*) as count from places where user_id = ?",
        [userId],
      );
      return Number(row?.count ?? 0);
    },
  };

  const visits = {
    async listByUser(userId: string): Promise<Visit[]> {
      const rows = await db.all<VisitRow>(
        `select ${VISIT_COLUMNS} from visits where user_id = ? order by visited_at desc`,
        [userId],
      );
      return rows.map(toVisit);
    },
    async listByPlace(userId: string, placeId: string): Promise<Visit[]> {
      const rows = await db.all<VisitRow>(
        `select ${VISIT_COLUMNS} from visits where user_id = ? and place_id = ? order by visited_at desc`,
        [userId, placeId],
      );
      return rows.map(toVisit);
    },
    async findById(userId: string, id: string): Promise<Visit | null> {
      const row = await db.get<VisitRow>(
        `select ${VISIT_COLUMNS} from visits where user_id = ? and id = ?`,
        [userId, id],
      );
      return row ? toVisit(row) : null;
    },
    async insert(visit: Visit): Promise<Visit> {
      await db.run(
        `insert into visits (${VISIT_COLUMNS}) values (${columnPlaceholders(VISIT_COLUMNS)})`,
        [
          visit.id,
          visit.userId,
          visit.placeId,
          visit.visitedAt,
          visit.occasion,
          visit.partySize,
          visit.rating,
          visit.thoughts,
          visit.spendPerPerson,
          visit.wouldReturn === null ? null : visit.wouldReturn ? 1 : 0,
          encodeJson(visit.tags),
          visit.createdAt,
        ],
      );
      return visit;
    },
    async update(userId: string, id: string, patch: Partial<Visit>): Promise<void> {
      const map: Record<string, string> = {
        visitedAt: "visited_at",
        occasion: "occasion",
        partySize: "party_size",
        rating: "rating",
        thoughts: "thoughts",
        spendPerPerson: "spend_per_person",
        wouldReturn: "would_return",
        tags: "tags",
      };
      const assignments: string[] = [];
      const values: SqlValue[] = [];
      for (const [key, column] of Object.entries(map)) {
        if (!(key in patch)) continue;
        const value = patch[key as keyof Visit];
        assignments.push(`${column} = ?`);
        if (key === "tags") values.push(encodeJson(value));
        else if (key === "wouldReturn") values.push(value === null ? null : value ? 1 : 0);
        else values.push((value ?? null) as SqlValue);
      }
      if (assignments.length === 0) return;
      await db.run(`update visits set ${assignments.join(", ")} where user_id = ? and id = ?`, [
        ...values,
        userId,
        id,
      ]);
    },
    async delete(userId: string, id: string): Promise<void> {
      await db.run("delete from visits where user_id = ? and id = ?", [userId, id]);
    },
  };

  const foodItems = {
    async listByUser(userId: string): Promise<FoodItem[]> {
      const rows = await db.all<FoodItemRow>(
        `select ${FOOD_ITEM_COLUMNS} from food_items where user_id = ? order by created_at desc`,
        [userId],
      );
      return rows.map(toFoodItem);
    },
    async listByVisit(userId: string, visitId: string): Promise<FoodItem[]> {
      const rows = await db.all<FoodItemRow>(
        `select ${FOOD_ITEM_COLUMNS} from food_items where user_id = ? and visit_id = ?`,
        [userId, visitId],
      );
      return rows.map(toFoodItem);
    },
    async listByPlace(userId: string, placeId: string): Promise<FoodItem[]> {
      const rows = await db.all<FoodItemRow>(
        `select ${FOOD_ITEM_COLUMNS} from food_items where user_id = ? and place_id = ? order by rating desc`,
        [userId, placeId],
      );
      return rows.map(toFoodItem);
    },
    async insertMany(items: FoodItem[]): Promise<FoodItem[]> {
      for (const item of items) {
        await db.run(
          `insert into food_items (${FOOD_ITEM_COLUMNS}) values (${columnPlaceholders(FOOD_ITEM_COLUMNS)})`,
          [
            item.id,
            item.userId,
            item.visitId,
            item.placeId,
            item.name,
            item.category,
            item.rating,
            item.comment,
            item.isHighlight ? 1 : 0,
            item.price,
            item.createdAt,
          ],
        );
      }
      return items;
    },
    async deleteByVisit(userId: string, visitId: string): Promise<void> {
      await db.run("delete from food_items where user_id = ? and visit_id = ?", [userId, visitId]);
    },
    async delete(userId: string, id: string): Promise<void> {
      await db.run("delete from food_items where user_id = ? and id = ?", [userId, id]);
    },
    async update(userId: string, id: string, patch: Partial<FoodItem>): Promise<void> {
      const map: Record<string, string> = {
        name: "name",
        category: "category",
        rating: "rating",
        comment: "comment",
        isHighlight: "is_highlight",
        price: "price",
      };
      const assignments: string[] = [];
      const values: SqlValue[] = [];
      for (const [key, column] of Object.entries(map)) {
        if (!(key in patch)) continue;
        const value = patch[key as keyof FoodItem];
        assignments.push(`${column} = ?`);
        if (key === "isHighlight") values.push(value ? 1 : 0);
        else values.push((value ?? null) as SqlValue);
      }
      if (assignments.length === 0) return;
      await db.run(`update food_items set ${assignments.join(", ")} where user_id = ? and id = ?`, [
        ...values,
        userId,
        id,
      ]);
    },
  };

  const refreshes = {
    async insert(entry: {
      userId: string;
      placeId: string;
      source: string;
      status: string;
      changedFields: string[];
      preservedFields: string[];
      message?: string | null;
    }) {
      await db.run(
        `insert into place_refreshes (id, user_id, place_id, source, status, changed_fields, preserved_fields, message, created_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId("ref"),
          entry.userId,
          entry.placeId,
          entry.source,
          entry.status,
          encodeJson(entry.changedFields),
          encodeJson(entry.preservedFields),
          entry.message ?? null,
          new Date().toISOString(),
        ],
      );
    },
    async listByPlace(userId: string, placeId: string, limit = 5): Promise<PlaceRefreshRow[]> {
      return db.all<PlaceRefreshRow>(
        `select * from place_refreshes where user_id = ? and place_id = ? order by created_at desc limit ${Number(limit) || 5}`,
        [userId, placeId],
      );
    },
  };

  return { db, users, sessions, places, visits, foodItems, refreshes };
}

export type Repositories = ReturnType<typeof createRepositories>;

export async function withRepositories<T>(
  fn: (repos: Repositories) => Promise<T>,
  db: SqlClient = getDb(),
): Promise<T> {
  await ensureMigrations(db);
  return fn(createRepositories(db));
}

function placeValues(place: Place): SqlValue[] {
  return (Object.keys(PLACE_FIELD_MAP) as (keyof Place)[]).map((key) => {
    const value = place[key];
    if (PLACE_JSON_FIELDS.has(key)) return encodeJson(value ?? null);
    return (value ?? null) as SqlValue;
  });
}

function placeAssignments(patch: Partial<Place>) {
  const assignments: string[] = [];
  const values: SqlValue[] = [];
  for (const key of Object.keys(patch) as (keyof Place)[]) {
    const column = PLACE_FIELD_MAP[key];
    if (!column || key === "id" || key === "userId" || key === "createdAt") continue;
    assignments.push(`${column} = ?`);
    const value = patch[key];
    values.push(
      PLACE_JSON_FIELDS.has(key) ? encodeJson(value ?? null) : ((value ?? null) as SqlValue),
    );
  }
  return { assignments, values };
}

function columnPlaceholders(columns: string): string {
  return columns.split(",").map(() => "?").join(", ");
}
