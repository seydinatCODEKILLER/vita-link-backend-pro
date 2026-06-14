import { PrismaService } from '@/prisma/prisma.service';

type PrismaModel = {
  findUnique: (...args: any[]) => Promise<any>;
  findFirst: (...args: any[]) => Promise<any>;
  findMany: (...args: any[]) => Promise<any>;
  create: (...args: any[]) => Promise<any>;
  update: (...args: any[]) => Promise<any>;
  updateMany: (...args: any[]) => Promise<any>;
  upsert: (...args: any[]) => Promise<any>;
  delete: (...args: any[]) => Promise<any>;
  deleteMany: (...args: any[]) => Promise<any>;
  count: (...args: any[]) => Promise<number>;
  aggregate: (...args: any[]) => Promise<any>;
  groupBy: (...args: any[]) => Promise<any>;
  createMany: (...args: any[]) => Promise<any>;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export abstract class BaseRepository<TModel extends PrismaModel> {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly model: TModel,
  ) {}

  protected isValidId(id: string): boolean {
    return UUID_REGEX.test(id);
  }

  async findById<T>(id: string, options?: object): Promise<T | null> {
    if (!this.isValidId(id)) return null;
    return this.model.findUnique({
      where: { id },
      ...options,
    }) as Promise<T | null>;
  }

  async findOne<T>(where: object, options?: object): Promise<T | null> {
    return this.model.findUnique({ where, ...options }) as Promise<T | null>;
  }

  async findFirst<T>(where: object, options?: object): Promise<T | null> {
    return this.model.findFirst({ where, ...options }) as Promise<T | null>;
  }

  async findMany<T>(
    where: object = {},
    options: {
      page?: number;
      limit?: number;
      orderBy?: object;
      select?: object;
      include?: object;
    } = {},
  ): Promise<T[]> {
    const { page, limit, orderBy, ...rest } = options;
    return this.model.findMany({
      where,
      skip: page && limit ? (page - 1) * limit : undefined,
      take: limit,
      orderBy: orderBy ?? { createdAt: 'desc' },
      ...rest,
    }) as Promise<T[]>;
  }

  async findManyWithCount<T>(
    where: object = {},
    options: {
      page?: number;
      limit?: number;
      orderBy?: object;
      select?: object;
      include?: object;
    } = {},
  ): Promise<{ data: T[]; total: number }> {
    const { page, limit, orderBy, ...rest } = options;

    const [data, total] = await Promise.all([
      this.model.findMany({
        where,
        skip: page && limit ? (page - 1) * limit : undefined,
        take: limit,
        orderBy: orderBy ?? { createdAt: 'desc' },
        ...rest,
      }) as Promise<T[]>,
      this.model.count({ where }),
    ]);

    return { data, total };
  }

  async create<T>(data: object, options?: object): Promise<T> {
    return this.model.create({ data, ...options }) as Promise<T>;
  }

  async createMany(data: object[]): Promise<{ count: number }> {
    return this.model.createMany({ data }) as Promise<{ count: number }>;
  }

  async update<T>(
    id: string,
    data: object,
    options?: object,
  ): Promise<T | null> {
    if (!this.isValidId(id)) return null;
    return this.model.update({ where: { id }, data, ...options }) as Promise<T>;
  }

  async updateMany(where: object, data: object): Promise<{ count: number }> {
    return this.model.updateMany({ where, data }) as Promise<{ count: number }>;
  }

  async upsert<T>(
    where: object,
    create: object,
    update: object,
    options?: object,
  ): Promise<T> {
    return this.model.upsert({
      where,
      create,
      update,
      ...options,
    }) as Promise<T>;
  }

  async delete<T>(id: string): Promise<T | null> {
    if (!this.isValidId(id)) return null;
    return this.model.delete({ where: { id } }) as Promise<T>;
  }

  async deleteMany(where: object): Promise<{ count: number }> {
    return this.model.deleteMany({ where }) as Promise<{ count: number }>;
  }

  async count(where: object = {}): Promise<number> {
    return this.model.count({ where });
  }

  async exists(where: object): Promise<boolean> {
    const count = await this.model.count({ where });
    return count > 0;
  }
}
