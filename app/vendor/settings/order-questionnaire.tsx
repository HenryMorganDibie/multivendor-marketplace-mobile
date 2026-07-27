import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Dimensions } from 'react-native';
import { Alert } from '@/utils/alert';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Plus, Trash2, GripVertical } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

type QuestionType = 'short-text' | 'multiple-choice';

interface Question {
  id: string;
  text: string;
  type: QuestionType;
  required: boolean;
  choices?: string[];
}

export default function OrderQuestionnaireScreen() {
  const [enabled, setEnabled] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  const MAX_QUESTIONS = 8;

  const handleAddQuestion = () => {
    if (questions.length >= MAX_QUESTIONS) {
      Alert.alert('Limit Reached', `You can add up to ${MAX_QUESTIONS} questions.`);
      return;
    }
    setEditingQuestion({
      id: Date.now().toString(),
      text: '',
      type: 'short-text',
      required: true,
      choices: [],
    });
    setShowAddModal(true);
  };

  const handleSaveQuestion = () => {
    if (!editingQuestion || !editingQuestion.text.trim()) {
      Alert.alert('Error', 'Question text is required.');
      return;
    }

    if (editingQuestion.type === 'multiple-choice') {
      const validChoices = (editingQuestion.choices || []).filter(c => c.trim());
      if (validChoices.length < 2) {
        Alert.alert('Error', 'Multiple choice questions must have at least 2 choices.');
        return;
      }
      editingQuestion.choices = validChoices;
    }

    const existingIndex = questions.findIndex(q => q.id === editingQuestion.id);
    if (existingIndex >= 0) {
      const updated = [...questions];
      updated[existingIndex] = editingQuestion;
      setQuestions(updated);
    } else {
      setQuestions([...questions, editingQuestion]);
    }

    setShowAddModal(false);
    setEditingQuestion(null);
  };

  const handleDeleteQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleEditQuestion = (question: Question) => {
    setEditingQuestion({ ...question });
    setShowAddModal(true);
  };

  const renderQuestion = (question: Question, _index: number) => (
    <View key={question.id} style={styles.questionCard}>
      <View style={styles.questionHeader}>
        <GripVertical size={20} color={Colors.textSecondary} />
        <View style={styles.questionHeaderContent}>
          <Text style={styles.questionText}>{question.text}</Text>
          <Text style={styles.questionMeta}>
            {question.type === 'short-text' ? 'Short text' : 'Multiple choice'} • {question.required ? 'Required' : 'Optional'}
          </Text>
        </View>
      </View>
      <View style={styles.questionActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEditQuestion(question)}
          activeOpacity={0.7}
        >
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteQuestion(question.id)}
          activeOpacity={0.7}
        >
          <Trash2 size={16} color={Colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Order Questionnaire',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.charcoal,
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => Alert.alert('Saved', 'Questionnaire settings saved.')}
              activeOpacity={0.7}
            >
              <Text style={questionnaireHeaderStyles.saveText}>Save</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.toggleCard}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Enable questionnaire</Text>
              <TouchableOpacity
                style={[styles.toggle, enabled && styles.toggleActive]}
                onPress={() => setEnabled(!enabled)}
                activeOpacity={0.7}
              >
                <View style={[styles.toggleThumb, enabled && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>
          </View>

          {enabled && (
            <>
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Questions</Text>
                  <Text style={styles.questionCount}>{questions.length}/{MAX_QUESTIONS}</Text>
                </View>

                {questions.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No questions yet</Text>
                  </View>
                ) : (
                  questions.map((question, index) => renderQuestion(question, index))
                )}

                {questions.length < MAX_QUESTIONS && (
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={handleAddQuestion}
                    activeOpacity={0.7}
                  >
                    <Plus size={20} color={Colors.primary} />
                    <Text style={styles.addButtonText}>Add question</Text>
                  </TouchableOpacity>
                )}
              </View>

            </>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowAddModal(false);
          setEditingQuestion(null);
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowAddModal(false);
            setEditingQuestion(null);
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false);
                  setEditingQuestion(null);
                }}
                activeOpacity={0.7}
                style={styles.headerButton}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <Text style={styles.modalTitle}>
                {editingQuestion?.id && questions.find(q => q.id === editingQuestion.id) ? 'Edit question' : 'Add question'}
              </Text>
              
              <TouchableOpacity
                onPress={handleSaveQuestion}
                activeOpacity={0.7}
                style={styles.headerButton}
                disabled={!editingQuestion?.text.trim()}
              >
                <Text style={[
                  styles.headerSaveButtonText,
                  !editingQuestion?.text.trim() && styles.saveButtonDisabled
                ]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalContent} 
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.formContainer}>
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Question text</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Any dietary restrictions?"
                    placeholderTextColor={Colors.textSecondary}
                    value={editingQuestion?.text || ''}
                    onChangeText={(text) => {
                      if (text.length <= 120) {
                        setEditingQuestion(prev => prev ? { ...prev, text } : null);
                      }
                    }}
                    maxLength={120}
                    multiline
                    scrollEnabled={false}
                  />
                </View>

                <View style={styles.typeSelector}>
                  <Text style={styles.typeLabel}>Type</Text>
                  <View style={styles.typeButtons}>
                    <TouchableOpacity
                      style={[styles.typeButton, editingQuestion?.type === 'short-text' && styles.typeButtonActive]}
                      onPress={() => setEditingQuestion(prev => prev ? { ...prev, type: 'short-text' } : null)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.typeButtonText, editingQuestion?.type === 'short-text' && styles.typeButtonTextActive]}>Short text</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.typeButton, editingQuestion?.type === 'multiple-choice' && styles.typeButtonActive]}
                      onPress={() => setEditingQuestion(prev => prev ? { ...prev, type: 'multiple-choice', choices: ['', ''] } : null)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.typeButtonText, editingQuestion?.type === 'multiple-choice' && styles.typeButtonTextActive]}>Multiple choice</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {editingQuestion?.type === 'multiple-choice' && (
                  <View style={styles.choicesContainer}>
                    <Text style={styles.choicesLabel}>Choices</Text>
                    {(editingQuestion.choices || []).map((choice, index) => (
                      <View key={index} style={styles.choiceRow}>
                        <TextInput
                          style={styles.choiceInput}
                          placeholder={`Choice ${index + 1}`}
                          placeholderTextColor={Colors.textSecondary}
                          value={choice}
                          onChangeText={(text) => {
                            if (text.length <= 40) {
                              const newChoices = [...(editingQuestion.choices || [])];
                              newChoices[index] = text;
                              setEditingQuestion(prev => prev ? { ...prev, choices: newChoices } : null);
                            }
                          }}
                          maxLength={40}
                        />
                        {(editingQuestion.choices || []).length > 2 && (
                          <TouchableOpacity
                            onPress={() => {
                              const newChoices = (editingQuestion.choices || []).filter((_, i) => i !== index);
                              setEditingQuestion(prev => prev ? { ...prev, choices: newChoices } : null);
                            }}
                            activeOpacity={0.7}
                          >
                            <Trash2 size={18} color={Colors.error} />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                    {(editingQuestion.choices || []).length < 6 && (
                      <TouchableOpacity
                        style={styles.addChoiceButton}
                        onPress={() => {
                          const newChoices = [...(editingQuestion.choices || []), ''];
                          setEditingQuestion(prev => prev ? { ...prev, choices: newChoices } : null);
                        }}
                        activeOpacity={0.7}
                      >
                        <Plus size={16} color={Colors.primary} />
                        <Text style={styles.addChoiceText}>Add choice</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <View style={styles.requiredSelector}>
                  <View style={styles.requiredRow}>
                    <Text style={styles.requiredLabel}>Required to submit order</Text>
                    <TouchableOpacity
                      style={[styles.toggle, editingQuestion?.required && styles.toggleActive]}
                      onPress={() => setEditingQuestion(prev => prev ? { ...prev, required: !prev.required } : null)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.toggleThumb, editingQuestion?.required && styles.toggleThumbActive]} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const questionnaireHeaderStyles = StyleSheet.create({
  saveText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  toggleCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
  },
  toggleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  toggleLabel: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  toggle: {
    width: 51,
    height: 31,
    borderRadius: 16,
    backgroundColor: Colors.border,
    padding: 2,
    justifyContent: 'center' as const,
  },
  toggleActive: {
    backgroundColor: Colors.primary,
  },
  toggleThumb: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: Colors.background,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  questionCount: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  emptyState: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center' as const,
  },
  emptyStateText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  questionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  questionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    marginBottom: 12,
  },
  questionHeaderContent: {
    flex: 1,
    marginLeft: 12,
  },
  questionText: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '500' as const,
    marginBottom: 4,
  },
  questionMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  questionActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
    gap: 12,
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.white,
  },
  actionButtonText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
  },
  addButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  addButtonText: {
    fontSize: 17,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 6,
  },
  bottomSpacer: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end' as const,
  },
  modalSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: Dimensions.get('window').height * 0.7,
    minHeight: Dimensions.get('window').height * 0.6,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerButton: {
    minWidth: 60,
  },
  cancelButtonText: {
    fontSize: 17,
    color: Colors.primary,
  },
  headerSaveButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.primary,
    textAlign: 'right' as const,
  },
  saveButtonDisabled: {
    color: Colors.textSecondary,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
  },
  modalContent: {
    maxHeight: Dimensions.get('window').height * 0.7 - 64,
  },
  formContainer: {
    padding: 16,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 17,
    color: Colors.text,
    minHeight: 60,
    maxHeight: 80,
    textAlignVertical: 'top' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeSelector: {
    marginBottom: 20,
  },
  typeLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  typeButtons: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  typeButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeButtonActive: {
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    borderColor: Colors.primary,
  },
  typeButtonText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  typeButtonTextActive: {
    color: Colors.primary,
  },
  choicesContainer: {
    marginBottom: 20,
  },
  choicesLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  choiceRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 8,
  },
  choiceInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addChoiceButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 8,
  },
  addChoiceText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  requiredSelector: {
    marginBottom: 20,
  },
  requiredRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  requiredLabel: {
    fontSize: 15,
    color: Colors.text,
  },
});
