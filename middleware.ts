
import { withAuth } from "next-auth/middleware";

export default withAuth({
    callbacks: {
        authorized: ({ token }) => !!token, // Return true if logged in
    },
});

export const config = {
    matcher: ["/admin/:path*"], // Protect all routes under /admin
};
