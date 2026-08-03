import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        /*
         * `/privacy` là đường dẫn cũ, đã đổi sang tiếng Việt khi dựng website
         * công khai. Giữ redirect vĩnh viễn vì đường dẫn cũ có thể đã nằm trong
         * link đã share ra ngoài và trong index của search engine — bỏ hẳn là mất
         * cả người đọc và tín hiệu SEO đã tích được.
         */
        source: "/privacy",
        destination: "/chinh-sach-bao-mat",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
