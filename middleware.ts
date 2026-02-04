
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    function middleware(req) {
        // x-pathnameヘッダーを追加（layout.tsxでパス判定に使用）
        const response = NextResponse.next();
        response.headers.set("x-pathname", req.nextUrl.pathname);
        return response;
    },
    {
        callbacks: {
            authorized: ({ token }) => !!token,
        },
    }
);

export const config = {
    matcher: ["/admin/:path*"],
};
