"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createLearningArticle, learningContentKeys, listLearningArticles, listLearningQuizzes, listQuizQuestions, saveQuizQuestion, updateLearningArticle, type ArticleInput, type QuestionInput } from "./learning-content-api";

export const useLearningQuizzes = () => useQuery({ queryKey: learningContentKeys.quizzes, queryFn: listLearningQuizzes });
export const useLearningQuestions = (versionId: number | null) => useQuery({ queryKey: learningContentKeys.questions(versionId ?? 0), queryFn: () => listQuizQuestions(versionId!), enabled: versionId !== null });
export const useSaveLearningQuestion = () => { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, versionId: _versionId, input }: { id: number; versionId: number; input: QuestionInput }) => saveQuizQuestion(id, input), onSuccess: (_result, variables) => client.invalidateQueries({ queryKey: learningContentKeys.questions(variables.versionId) }) }); };
export const useLearningArticles = () => useQuery({ queryKey: learningContentKeys.articles, queryFn: listLearningArticles });
export const useSaveLearningArticle = () => { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, input }: { id: number | null; input: ArticleInput }) => id === null ? createLearningArticle(input) : updateLearningArticle(id, input), onSuccess: () => client.invalidateQueries({ queryKey: learningContentKeys.articles }) }); };
