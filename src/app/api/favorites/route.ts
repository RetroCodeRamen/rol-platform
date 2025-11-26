import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import User from '@/lib/db/models/User';

// GET - Fetch user's favorites
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      );
    }

    await dbConnect();

    const user = await User.findById(userId).lean();
    if (!user) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      );
    }

    const favorites = (user.favorites || []).map((fav: any) => ({
      id: fav.id,
      title: fav.title,
      windowType: fav.windowType,
      url: fav.url,
      options: fav.options,
      createdAt: fav.createdAt,
    }));

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        favorites,
      })
    );
  } catch (error: any) {
    console.error('Failed to fetch favorites:', error);
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to fetch favorites' },
        { status: 500 }
      )
    );
  }
}

// POST - Add a favorite
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      );
    }

    await dbConnect();

    const body = await request.json();
    const { title, windowType, url, options } = body;

    if (!title || !windowType) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Title and windowType are required' },
          { status: 400 }
        )
      );
    }

    const user = await User.findById(userId);
    if (!user) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      );
    }

    // Check if favorite already exists (by title and windowType)
    const existingFavorite = user.favorites?.find(
      (fav: any) => fav.title === title && fav.windowType === windowType
    );

    if (existingFavorite) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Favorite already exists' },
          { status: 409 }
        )
      );
    }

    // Add new favorite
    const newFavorite = {
      id: `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      windowType,
      url: url || undefined,
      options: options || undefined,
      createdAt: new Date(),
    };

    if (!user.favorites) {
      user.favorites = [];
    }
    user.favorites.push(newFavorite);
    await user.save();

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        favorite: newFavorite,
      })
    );
  } catch (error: any) {
    console.error('Failed to add favorite:', error);
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to add favorite' },
        { status: 500 }
      )
    );
  }
}

// DELETE - Remove a favorite
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      );
    }

    await dbConnect();

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Favorite ID is required' },
          { status: 400 }
        )
      );
    }

    const user = await User.findById(userId);
    if (!user) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      );
    }

    // Remove favorite
    if (user.favorites) {
      user.favorites = user.favorites.filter((fav: any) => fav.id !== id);
      await user.save();
    }

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        message: 'Favorite removed',
      })
    );
  } catch (error: any) {
    console.error('Failed to remove favorite:', error);
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to remove favorite' },
        { status: 500 }
      )
    );
  }
}

