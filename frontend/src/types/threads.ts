export type Category = {
  id: number;
  slug: string;
  name: string;
  description: string;
};

export type ThreadSummary = {
  id: number;
  title: string;
  excerpt: string;
  createdAt: string;
  category: {
    slug: string;
    name: string;
  };
  author: {
    displayName: string | null;
    handle: string | null;
  };
};

export type ThreadDetail = {
  id: number;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  category: {
    slug: string;
    name: string;
  };
  author: {
    displayName: string | null;
    handle: string | null;
  };

};