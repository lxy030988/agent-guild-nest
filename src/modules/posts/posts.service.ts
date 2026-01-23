import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  private get post() {
    return (this.prisma as PrismaService & { post: any }).post;
  }

  async create(createPostDto: CreatePostDto) {
    return this.post.create({
      data: createPostDto,
      include: {
        author: true, // 包含作者信息
      },
    });
  }

  async findAll() {
    return this.post.findMany({
      include: {
        author: true,
      },
    });
  }

  async findByAuthor(authorId: number) {
    return this.post.findMany({
      where: { authorId },
      include: {
        author: true,
      },
    });
  }

  async findOne(id: number) {
    const post = await this.post.findUnique({
      where: { id },
      include: {
        author: true,
      },
    });

    if (!post) {
      throw new NotFoundException(`Post #${id} not found`);
    }

    return post;
  }

  async update(id: number, updatePostDto: UpdatePostDto) {
    try {
      return await this.post.update({
        where: { id },
        data: updatePostDto,
        include: {
          author: true,
        },
      });
    } catch (error) {
      throw new NotFoundException(`Post #${id} not found`);
    }
  }

  async remove(id: number) {
    try {
      return await this.post.delete({
        where: { id },
      });
    } catch (error) {
      throw new NotFoundException(`Post #${id} not found`);
    }
  }
}
