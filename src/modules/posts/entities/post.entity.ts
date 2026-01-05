export class Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<Post>) {
    Object.assign(this, partial);
  }
}
