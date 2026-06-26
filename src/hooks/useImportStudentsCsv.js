import { useMutation } from "@tanstack/react-query";
import axios from "../api/axiosInstance";

export function useImportStudentsCsv() {
  return useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await axios.post("/import/students-csv", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    },
  });
}
