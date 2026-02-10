"use client";

import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register Japanese font (using a CDN or local font if available, 
// for MVP we might default to standard sans if CDN fails, but let's try to set up Noto Sans JP)
// Note: In a real prod env, you'd host the font file locally. 
// For this MVP, we will try to use a standard font or assume the user environment might not render JPN perfectly 
// without a registered font. To be safe, we will register a font from a public URL.
// Register Japanese font (using a static CDN for reliability)
// Register Japanese font (using Google Fonts TTF as reliable source)
Font.register({
    family: 'Noto Sans JP',
    fonts: [
        { src: 'https://fonts.gstatic.com/s/notosansjp/v52/-7w6JnjDsRh992H8S3v90_f7D5r2T-7v.ttf' }, // Standard
        { src: 'https://fonts.gstatic.com/s/notosansjp/v52/-7w-JnjDsRh992H8S3v90_f7D5r2T-7v.ttf', fontWeight: 'bold' } // Bold
    ]
});

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontFamily: 'Noto Sans JP',
        fontSize: 12,
        color: '#333',
    },
    header: {
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
        paddingBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2563EB', // Blue-600
    },
    subTitle: {
        fontSize: 10,
        color: '#666',
    },
    studentSection: {
        marginBottom: 20,
        backgroundColor: '#F3F4F6', // Gray-100
        padding: 10,
        borderRadius: 4,
    },
    studentName: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    scoreSection: {
        flexDirection: 'row',
        marginBottom: 20,
        gap: 10,
    },
    scoreCard: {
        flex: 1,
        padding: 15,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 4,
        alignItems: 'center',
    },
    scoreLabel: {
        fontSize: 10,
        color: '#666',
        marginBottom: 4,
    },
    scoreValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2563EB',
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 8,
        marginTop: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#2563EB',
        paddingLeft: 6,
    },
    text: {
        fontSize: 11,
        lineHeight: 1.5,
        marginBottom: 4,
    },
    weaknessItem: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    bullet: {
        width: 10,
        fontSize: 10,
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 40,
        right: 40,
        textAlign: 'center',
        fontSize: 9,
        color: '#999',
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingTop: 10,
    },
});

type AnalysisPDFProps = {
    data: {
        studentName: string;
        testDate: string;
        subject: string;
        unitName: string;
        score: number;
        maxScore: number;
        comprehension: number;
        summary: string;
        weaknesses: { topic: string; level: string }[];
    };
};

export default function AnalysisPDF({ data }: AnalysisPDFProps) {
    return (
        <Document>
            <Page size="A4" style={styles.page}>

                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Score Snap Omni</Text>
                        <Text style={styles.subTitle}>AI採点・学習分析レポート</Text>
                    </View>
                    <View>
                        <Text style={styles.subTitle}>実施日: {data.testDate}</Text>
                    </View>
                </View>

                {/* Student Info */}
                <View style={styles.studentSection}>
                    <Text style={styles.studentName}>{data.studentName} 様</Text>
                    <Text style={styles.text}>教科: {data.subject} | 単元: {data.unitName}</Text>
                </View>

                {/* Score Cards */}
                <View style={styles.scoreSection}>
                    <View style={styles.scoreCard}>
                        <Text style={styles.scoreLabel}>得点</Text>
                        <Text style={styles.scoreValue}>{data.score} / {data.maxScore}</Text>
                    </View>
                    <View style={styles.scoreCard}>
                        <Text style={styles.scoreLabel}>学習理解度</Text>
                        <Text style={styles.scoreValue}>{data.comprehension}%</Text>
                    </View>
                </View>

                {/* AI Insight */}
                <View>
                    <Text style={styles.sectionTitle}>AI分析・学習アドバイス</Text>
                    <Text style={styles.text}>{data.summary}</Text>
                </View>

                {/* Weakness Areas */}
                {data.weaknesses.length > 0 && (
                    <View>
                        <Text style={styles.sectionTitle}>重点復習ポイント</Text>
                        {data.weaknesses.map((w, i) => (
                            <View key={i} style={styles.weaknessItem}>
                                <Text style={styles.bullet}>•</Text>
                                <Text style={styles.text}>
                                    {w.topic} {w.level === 'Primary' ? '(最優先)' : ''}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Footer */}
                <View style={styles.footer}>
                    <Text>Generated by Score Snap Omni - The Next Gen Grading Scanner</Text>
                </View>

            </Page>
        </Document>
    );
}
