import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPostDto: CreatePostDto) {
    return this.prisma.post.create({
      data: createPostDto,
      include: {
        author: true, // 包含作者信息
      },
    });
  }

  async findAll() {
    return this.prisma.post.findMany({
      include: {
        author: true,
      },
    });
  }

  async findByAuthor(authorId: number) {
    return this.prisma.post.findMany({
      where: { authorId },
      include: {
        author: true,
      },
    });
  }

  async findOne(id: number) {
    const post = await this.prisma.post.findUnique({
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
      return await this.prisma.post.update({
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
      return await this.prisma.post.delete({
        where: { id },
      });
    } catch (error) {
      throw new NotFoundException(`Post #${id} not found`);
    }
  }
}
